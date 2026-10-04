import { Platform } from 'react-native';
import {
  deleteToken,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { ApiSession, post } from '../api/client';
import { notificationService } from './notificationService';

let currentSession: ApiSession | null = null;
let refreshListenerReady = false;

const messaging = getMessaging();

async function showPush(message: RemoteMessage) {
  const data = message.data || {};
  if (data.type !== 'chat_message') return;
  await notificationService.displayMessageNotification(
    String(data.contactName || data.contactNumber || 'New message'),
    String(data.messageText || ''),
    String(data.contactNumber || ''),
    data.mediaType ? String(data.mediaType) : undefined,
  );
}

export function registerBackgroundPushHandler() {
  setBackgroundMessageHandler(messaging, showPush);
}

export async function registerDevicePush(session: ApiSession) {
  currentSession = session;
  await registerDeviceForRemoteMessages(messaging);
  const token = await getToken(messaging);
  if (!token) return;

  await post('/account/fcm-token', { token, platform: Platform.OS }, session);

  if (!refreshListenerReady) {
    refreshListenerReady = true;
    onTokenRefresh(messaging, async (nextToken) => {
      if (!currentSession) return;
      try {
        await post(
          '/account/fcm-token',
          { token: nextToken, platform: Platform.OS },
          currentSession,
        );
      } catch (error) {
        console.warn('Failed to refresh FCM token:', error);
      }
    });
  }
}

export async function unregisterDevicePush(session: ApiSession) {
  currentSession = null;
  try {
    const token = await getToken(messaging);
    if (token) {
      await post('/account/fcm-token/remove', { token }, session);
    }
    await deleteToken(messaging);
  } catch (error) {
    console.warn('Failed to remove FCM token:', error);
  }
}

export function listenForForegroundPush() {
  return onMessage(messaging, showPush);
}
