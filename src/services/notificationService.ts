import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
  Event as NotifeeEvent,
} from '@notifee/react-native';
import { AppState, Platform, PermissionsAndroid } from 'react-native';

const MESSAGE_CHANNEL_ID = 'onechat_messages';
const MESSAGE_CHANNEL_NAME = 'Chat Messages';

const SERVICE_CHANNEL_ID = 'onechat_service_channel';
const SERVICE_CHANNEL_NAME = 'Background Connection';

/**
 * Callback type for when user taps a notification.
 * The handler receives the contact number and name so the app can
 * navigate to the correct chat room.
 */
export type NotificationTapHandler = (
  contactNumber: string,
  contactName: string,
) => void;

class NotificationService {
  private channelsCreated = false;
  private activeChatNumber: string | null = null;
  private tapHandler: NotificationTapHandler | null = null;
  private isForegroundServiceRunning = false;

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
   * Start the Android Foreground Service to keep Socket.IO and the JS thread
   * running when the app is in the background or the screen is locked.
   */
  async startForegroundService() {
    if (Platform.OS !== 'android' || this.isForegroundServiceRunning) return;

    if (!this.channelsCreated) {
      await this.createChannels();
    }

    try {
      await notifee.displayNotification({
        id: 'onechat_foreground_service',
        title: 'OneChat is active',
        body: 'Listening for incoming messages in background',
        android: {
          channelId: SERVICE_CHANNEL_ID,
          asForegroundService: true,
          // Use built-in system icon as fallback — avoids "bad notification" crashes
          // when ic_notification drawable isn't found at runtime
          smallIcon: 'ic_notification',
          color: '#25D366',
          ongoing: true,
          importance: AndroidImportance.LOW,
          visibility: AndroidVisibility.SECRET,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
        },
      });
      this.isForegroundServiceRunning = true;
      console.log('✅ Foreground service started for background messages');
    } catch (err) {
      // Foreground service failed — log but do NOT crash the app
      // The app still works; just no background socket keepalive
      console.warn('Failed to start foreground service (non-fatal):', err);
    }
  }

  /**
   * Stop the Android Foreground Service (e.g. on user logout).
   */
  async stopForegroundService() {
    if (Platform.OS !== 'android') return;
    try {
      await notifee.stopForegroundService();
      await notifee.cancelNotification('onechat_foreground_service');
      this.isForegroundServiceRunning = false;
      console.log('🛑 Foreground service stopped');
    } catch (err) {
      console.warn('Failed to stop foreground service:', err);
    }
  }

  /**
   * Register a callback that fires when the user taps a notification.
   */
  onNotificationTap(handler: NotificationTapHandler) {
    this.tapHandler = handler;
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

    // Build display text for media messages
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

    try {
      await notifee.displayNotification({
        id: `chat_${contactNumber}`, // Reuse ID per contact to stack/replace
        title: contactName || contactNumber,
        body: displayText || 'New message',
        data: {
          contactNumber,
          contactName: contactName || contactNumber,
          type: 'chat_message',
        },
        android: {
          channelId: MESSAGE_CHANNEL_ID,
          smallIcon: 'ic_notification',
          color: '#25D366',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
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
   * Cancel all OneChatClient notifications.
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

      // 2. Silent low-priority channel for persistent foreground service
      await notifee.createChannel({
        id: SERVICE_CHANNEL_ID,
        name: SERVICE_CHANNEL_NAME,
        description: 'Maintains live chat connection while app is in background',
        importance: AndroidImportance.MIN,
        visibility: AndroidVisibility.SECRET,
        sound: undefined,
        vibration: false,
      });

      this.channelsCreated = true;
    } catch (error) {
      console.warn('Failed to create notification channels:', error);
    }
  }

  private setupEventListeners() {
    // Foreground events (app is open)
    notifee.onForegroundEvent(({ type, detail }: NotifeeEvent) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        const { contactNumber, contactName } = detail.notification.data as {
          contactNumber: string;
          contactName: string;
        };
        if (contactNumber && this.tapHandler) {
          this.tapHandler(contactNumber, contactName);
        }
      }
    });

    // Background events (app is in background)
    notifee.onBackgroundEvent(async ({ type, detail }: NotifeeEvent) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        const { contactNumber, contactName } = detail.notification.data as {
          contactNumber: string;
          contactName: string;
        };
        if (contactNumber && this.tapHandler) {
          this.tapHandler(contactNumber, contactName);
        }
      }
    });
  }
}

export const notificationService = new NotificationService();
