import React, {useEffect, useState} from 'react';
import {StatusBar, View} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import {AuthScreen} from './src/screens/AuthScreen';
import {SplashScreen} from './src/components/SplashScreen';
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

        if (!refreshed.selectedProjectId && refreshed.projects && refreshed.projects.length === 1) {
          refreshed.selectedProjectId = refreshed.projects[0].id;
        }

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

  // Clears the selected project (e.g. "switch workspace") without touching
  // the projects list itself.
  const deselectProject = async () => {
    if (!session) return;
    const updated = { ...session, selectedProjectId: undefined };
    await saveSession(updated);
    setSession(updated);
  };

  const handleProjectCreated = async (newProject: { id: string; name: string }) => {
    if (!session) return;
    const updated = {
      ...session,
      projects: [...(session.projects || []), newProject],
    };
    await saveSession(updated);
    setSession(updated);
  };

  // WorkspaceScreen now owns both the "has a project" experience and the
  // limited "no project yet" experience (Home / Wallet / Projects tabs),
  // so the only other top-level case left is picking between several
  // existing projects when none is currently selected.
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
        {session === undefined ? <SplashScreen /> : !session ? (
          <AuthScreen
            onAuthenticated={async authenticated => {
              let sessionToSave = authenticated;
              if (authenticated.projects && authenticated.projects.length === 1) {
                sessionToSave = { ...authenticated, selectedProjectId: authenticated.projects[0].id };
              }
              await saveSession(sessionToSave);
              setSession(sessionToSave);
            }}
          />
        ) : !session.selectedProjectId && session.projects && session.projects.length > 1 ? (
          <ProjectPickerScreen
            projects={session.projects}
            onSelect={selectProject}
          />
        ) : (
          <WorkspaceScreen
            session={session}
            onSelectProject={selectProject}
            onDeselectProject={deselectProject}
            onProjectCreated={handleProjectCreated}
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