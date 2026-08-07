import React, {useEffect, useState} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {AuthScreen} from './src/screens/AuthScreen';
import {WorkspaceScreen} from './src/screens/WorkspaceScreen';
import {Session, clearSession, loadSession} from './src/services/session';

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => { loadSession().then(setSession).catch(() => setSession(null)); }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {session === undefined ? null : session ? (
        <WorkspaceScreen session={session} onSignOut={async () => { await clearSession(); setSession(null); }} />
      ) : <AuthScreen onAuthenticated={setSession} />}
      <Toast />
    </SafeAreaProvider>
  );
}
