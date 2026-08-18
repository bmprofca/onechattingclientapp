import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Register background event handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
	// Let notification service listener handle taps
});

// Register foreground service task so background connection stays alive
notifee.registerForegroundService((notification) => {
	return new Promise(() => {
		// Long-running promise keeps the foreground service worker alive
	});
});

// Polyfill secure random for libraries that rely on `crypto.getRandomValues`.
try {
	// eslint-disable-next-line global-require, import/no-extraneous-dependencies
	require('react-native-get-random-values');
} catch (e) {
	// ignore if the package isn't installed; encryptPayload falls back to Math.random
}

AppRegistry.registerComponent(appName, () => App);
