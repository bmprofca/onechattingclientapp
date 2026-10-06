import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
  Event as NotifeeEvent,
  Notification,
} from '@notifee/react-native';
import { AppState, Platform, PermissionsAndroid } from 'react-native';
import type { ApiSession } from '../api/client';
import { markAsRead, sendMessage } from '../api/workspace';
import { loadSession } from './session';

const MESSAGE_CHANNEL_ID = 'onechat_messages';
const MESSAGE_CHANNEL_NAME = 'Chat Messages';
const APP_NAME = 'OneChatting';

/**
 * Callback type for when user taps a notification.
 * The handler receives the contact number and name so the app can
 * navigate to the correct chat room.
 */
export type NotificationTapHandler = (
  contactNumber: string,
  contactName: string,
) => void;

type NotificationTapData = {
  contactNumber?: string;
  contactName?: string;
  projectId?: string;
  messageWamid?: string;
};

class NotificationService {
  private channelsCreated = false;
  private activeChatNumber: string | null = null;
  private tapHandler: NotificationTapHandler | null = null;
  private pendingTap: { contactNumber: string; contactName: string } | null = null;
  private initialNotificationChecked = false;
  private recentKeys = new Map<string, number>();

  /**
   * Call once on app start. Creates the Android notification channels
   * and sets up event listeners for notification taps.
   */
  async initialize() {
    await this.createChannels();
    this.setupEventListeners();
  }

  /**
   * Request POST_NOTIFICATIONS permission (Android 13+).
   * On older versions this is a no-op.
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if battery optimization is enabled and prompt user to disable it
   * so Android doesn't kill the background socket connection.
   */
  async requestBatteryOptimizationPrompt() {
    if (Platform.OS !== 'android') return;
    try {
      const isOptimized = await notifee.isBatteryOptimizationEnabled();
      if (isOptimized) {
        await notifee.openBatteryOptimizationSettings();
      }
    } catch (e) {
      console.warn('Battery optimization prompt failed:', e);
    }
  }

  /**
   * Register a callback that fires when the user taps a notification.
   */
  onNotificationTap(handler: NotificationTapHandler) {
    this.tapHandler = handler;
    if (this.pendingTap) {
      const { contactNumber, contactName } = this.pendingTap;
      this.pendingTap = null;
      handler(contactNumber, contactName);
    }

    if (this.initialNotificationChecked) return;
    this.initialNotificationChecked = true;
    notifee
      .getInitialNotification()
      .then(initial => {
        if (initial?.notification?.data) {
          this.dispatchTap(
            initial.notification.data as NotificationTapData,
          );
        }
      })
      .catch(error => {
        console.warn('Failed to read initial notification:', error);
      });
  }

  async handleBackgroundEvent(event: NotifeeEvent) {
    if (event.type === EventType.PRESS && event.detail.notification?.data) {
      this.dispatchTap(event.detail.notification.data as NotificationTapData);
    } else if (event.type === EventType.ACTION_PRESS) {
      await this.handleAction(
        event.detail.notification,
        event.detail.pressAction?.id,
        event.detail.input,
      );
    }
  }

  private async handleAction(
    notification: Notification | undefined,
    actionId: string | undefined,
    input?: string,
  ) {
    if (
      !notification ||
      (actionId !== 'reply' && actionId !== 'mark_as_read')
    ) {
      return;
    }

    const data = (notification.data || {}) as NotificationTapData;
    const contactNumber = String(data.contactNumber || '');
    const projectId = String(data.projectId || '');

    if (actionId === 'reply' && !String(input || '').trim()) return;

    try {
      if (!contactNumber || !projectId) {
        throw new Error('Notification is missing its chat details.');
      }

      const storedSession = await loadSession();
      if (!storedSession?.token || !storedSession.username) {
        throw new Error('Sign in again to use notification actions.');
      }

      const session: ApiSession = {
        token: storedSession.token,
        username: storedSession.username,
      };

      if (actionId === 'reply') {
        await sendMessage(
          session,
          projectId,
          contactNumber,
          String(input).trim(),
          data.messageWamid || undefined,
        );
      } else {
        await markAsRead(session, projectId, contactNumber);
        await this.cancelNotificationsForContact(contactNumber);
      }
    } catch (error) {
      console.warn(`Notification ${actionId} action failed:`, error);
      await this.showActionFailure(notification, actionId);
    }
  }

  private async showActionFailure(
    notification: Notification,
    actionId: string,
  ) {
    try {
      await notifee.displayNotification({
        ...notification,
        body:
          actionId === 'reply'
            ? 'Could not send reply. Open the chat and try again.'
            : 'Could not mark as read. Open the chat and try again.',
      });
    } catch (error) {
      console.warn('Failed to show notification action error:', error);
    }
  }

  private dispatchTap(data: NotificationTapData) {
    const contactNumber = String(data.contactNumber || '');
    if (!contactNumber) return;
    const contactName = String(data.contactName || contactNumber);

    if (this.tapHandler) {
      this.tapHandler(contactNumber, contactName);
    } else {
      this.pendingTap = { contactNumber, contactName };
    }
  }

  /**
   * Set the contact number of the chat currently being viewed.
   * Notifications for this contact will be suppressed.
   */
  setActiveChat(contactNumber: string | null) {
    this.activeChatNumber = contactNumber ? String(contactNumber) : null;
  }

  /**
   * Clear the active chat (e.g. when navigating away from ChatRoomScreen).
   */
  clearActiveChat() {
    this.activeChatNumber = null;
  }

  /**
   * Display a native notification for an incoming message.
   * - Suppressed if the user is currently viewing that chat AND the app is in foreground
   * - Shows as heads-up notification with vibration
   */
  async displayMessageNotification(
    contactName: string,
    messageText: string,
    contactNumber: string,
    mediaType?: string,
    projectId?: string,
    messageWamid?: string,
  ) {
    // Don't show if user is in the same chat and app is in foreground
    if (
      this.activeChatNumber &&
      String(contactNumber) === this.activeChatNumber &&
      AppState.currentState === 'active'
    ) {
      return;
    }

    if (!this.channelsCreated) {
      await this.createChannels();
    }

    let displayText = messageText;
    if (!displayText && mediaType) {
      if (mediaType.includes('image')) displayText = '📷 Photo';
      else if (mediaType.includes('video')) displayText = '🎥 Video';
      else if (mediaType.includes('document') || mediaType.includes('pdf'))
        displayText = '📄 Document';
      else if (mediaType.includes('audio') || mediaType.includes('voice'))
        displayText = '🎵 Voice message';
      else displayText = '📎 Attachment';
    }

    const dedupeKey = `${contactNumber}:${displayText || 'New message'}`;
    const now = Date.now();
    if (now - (this.recentKeys.get(dedupeKey) || 0) < 4000) return;
    this.recentKeys.set(dedupeKey, now);

    try {
      await notifee.displayNotification({
        id: `chat_${contactNumber}`, // Reuse ID per contact to stack/replace
        title: APP_NAME,
        body: `${contactName || contactNumber}: ${displayText || 'New message'}`,
        data: {
          contactNumber,
          contactName: contactName || contactNumber,
          type: 'chat_message',
          projectId: projectId || '',
          messageWamid: messageWamid || '',
        },
        android: {
          channelId: MESSAGE_CHANNEL_ID,
          smallIcon: 'ic_notification',
          largeIcon: require('../assets/logo.png'),
          circularLargeIcon: true,
          color: '#25D366',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          actions: [
            {
              title: 'Reply',
              pressAction: { id: 'reply' },
              input: {
                allowFreeFormInput: true,
                placeholder: 'Reply...',
              },
            },
            {
              title: 'Mark as read',
              pressAction: { id: 'mark_as_read' },
            },
          ],
          showTimestamp: true,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.warn('Failed to display notification:', error);
    }
  }

  /**
   * Cancel all notifications for a specific contact
   * (e.g., when the user opens that chat).
   */
  async cancelNotificationsForContact(contactNumber: string) {
    try {
      await notifee.cancelNotification(`chat_${contactNumber}`);
    } catch {
      // ignore
    }
  }

  /**
   * Cancel all OneChatting notifications.
   */
  async cancelAll() {
    try {
      await notifee.cancelAllNotifications();
    } catch {
      // ignore
    }
  }

  // ---- Private ----

  private async createChannels() {
    if (Platform.OS !== 'android') return;
    try {
      // 1. High priority channel for message alerts (sound + vibration + heads-up)
      await notifee.createChannel({
        id: MESSAGE_CHANNEL_ID,
        name: MESSAGE_CHANNEL_NAME,
        description: 'Notifications for incoming chat messages',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
        lights: true,
        lightColor: '#25D366',
        sound: 'default',
      });

      this.channelsCreated = true;
    } catch (error) {
      console.warn('Failed to create notification channels:', error);
    }
  }

  private setupEventListeners() {
    // Foreground events (app is open)
    notifee.onForegroundEvent(async ({ type, detail }: NotifeeEvent) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        this.dispatchTap(detail.notification.data as NotificationTapData);
      } else if (type === EventType.ACTION_PRESS) {
        await this.handleAction(
          detail.notification,
          detail.pressAction?.id,
          detail.input,
        );
      }
    });
  }
}

export const notificationService = new NotificationService();
