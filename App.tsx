import React, {useEffect, useState} from 'react';
import {StatusBar, View} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import {AuthScreen} from './src/screens/AuthScreen';
import {WorkspaceScreen} from './src/screens/WorkspaceScreen';
import {ProjectPickerScreen} from './src/screens/ProjectPickerScreen';

import {getAccountProfile} from './src/api/auth';
import {
  Session,
  clearSession,
  loadSession,
  saveSession,
} from './src/services/session';
import {useTheme} from './src/theme/theme';

export default function App() {
  const theme = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const restoreSession = async () => {
      const stored = await loadSession();

      if (!stored) {
        setSession(null);
        return;
      }

      try {
        const account = await getAccountProfile({
          token: stored.token,
          username: stored.username,
        });

        const refreshed: Session = {
          ...stored,
          ...account,
          username: account.username || stored.username,
          selectedProjectId: stored.selectedProjectId,
        };

        await saveSession(refreshed);
        setSession(refreshed);
      } catch {
        await clearSession();
        setSession(null);
      }
    };

    restoreSession().catch(() => setSession(null));
  }, []);

  const selectProject = async (projectId: string) => {
    if (!session) return;

    const updated = {
      ...session,
      selectedProjectId: projectId,
    };

    await saveSession(updated);
    setSession(updated);
  };

  const chooseAnotherProject = async () => {
    if (!session) return;

    const updated = {
      ...session,
      selectedProjectId: undefined,
    };

    await saveSession(updated);
    setSession(updated);
  };

  // The status bar should match whichever screen is actually showing.
  // WorkspaceScreen has its own header bar (theme.header); every other
  // screen (Auth, ProjectPicker) sits directly on theme.canvas. Using a
  // single hardcoded color here was creating a visible seam at the top
  // of AuthScreen since its background never matched the status bar.
  const statusBarColor =
    session && session.selectedProjectId ? theme.header : theme.canvas;

  return (
    <SafeAreaProvider>
      <StatusBar
        translucent={false}
        backgroundColor={statusBarColor}
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
      />

      <SafeAreaView
        style={{flex: 1, backgroundColor: statusBarColor}}
        edges={['top', 'bottom', 'left', 'right']}
      >
        {session === undefined ? null : !session ? (
          <AuthScreen
            onAuthenticated={async authenticated => {
              await saveSession(authenticated);
              setSession(authenticated);
            }}
          />
        ) : !session.selectedProjectId ? (
          <ProjectPickerScreen
            projects={session.projects}
            onSelect={selectProject}
          />
        ) : (
          <WorkspaceScreen
            session={session}
            onChooseProject={chooseAnotherProject}
            onSignOut={async () => {
              await clearSession();
              setSession(null);
            }}
          />
        )}

        <View
          pointerEvents="box-none"
          style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0}}
        >
          <Toast />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}