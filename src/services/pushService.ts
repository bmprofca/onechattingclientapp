import { Platform } from 'react-native';
import {
  deleteToken,
  getMessaging,
  getInitialNotification,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { ApiSession, post } from '../api/client';
let currentSession: ApiSession | null = null;
let refreshListenerReady = false;

const messaging = getMessaging();

async function showPush(_message: RemoteMessage) {
  // Android shows the FCM notification payload itself. Posting another
  // local notification here duplicates it while the app is open.
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

export function listenForNotificationOpens(
  onOpen: (contactNumber: string, contactName: string) => void,
) {
  const openFrom = (message: RemoteMessage | null) => {
    const data = message?.data || {};
    const contactNumber = String(data.contactNumber || '');
    if (!contactNumber) return;
    onOpen(contactNumber, String(data.contactName || contactNumber));
  };

  const unsubscribe = onNotificationOpenedApp(messaging, openFrom);
  getInitialNotification(messaging).then(openFrom).catch(() => {});
  return unsubscribe;
}
