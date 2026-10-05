import { Linking } from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';

const WEB_URL = /^https?:\/\//i;

/**
 * Opens http(s) links in Chrome Custom Tabs when a supporting browser is
 * installed, so the page stays inside the app. Other schemes (WhatsApp,
 * phone, email) keep the system handler.
 */
export async function openLink(url: string) {
  const target = String(url || '').trim();
  if (!target) return;

  if (WEB_URL.test(target)) {
    try {
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(target, {
          dismissButtonStyle: 'close',
          preferredBarTintColor: '#09A01D',
          preferredControlTintColor: '#FFFFFF',
          animated: true,
          modalEnabled: true,
          showTitle: true,
          toolbarColor: '#09A01D',
          secondaryToolbarColor: '#FFFFFF',
          navigationBarColor: '#111111',
          navigationBarDividerColor: '#FFFFFF',
          enableUrlBarHiding: true,
          enableDefaultShare: true,
          hasBackButton: true,
          showInRecents: false,
        });
        return;
      }
    } catch {
      // Custom Tabs failed to launch. Fall through to the system handler.
    }
  }

  await Linking.openURL(target);
}
