/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Polyfill secure random for libraries that rely on `crypto.getRandomValues`.
// `react-native-get-random-values` exposes this but may not be installed in all setups,
// so require it only if present to avoid crashing the app.
try {
	// eslint-disable-next-line global-require, import/no-extraneous-dependencies
	require('react-native-get-random-values');
} catch (e) {
	// ignore if the package isn't installed; encryptPayload falls back to Math.random
}

AppRegistry.registerComponent(appName, () => App);
