import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { notificationService } from './src/services/notificationService';
import { registerBackgroundPushHandler } from './src/services/pushService';

registerBackgroundPushHandler();

notifee.onBackgroundEvent(async event => {
	await notificationService.handleBackgroundEvent(event);
});

// Polyfill secure random for libraries that rely on `crypto.getRandomValues`.
try {
	// eslint-disable-next-line global-require, import/no-extraneous-dependencies
	require('react-native-get-random-values');
} catch (e) {
	// ignore if the package isn't installed; encryptPayload falls back to Math.random
}

AppRegistry.registerComponent(appName, () => App);
