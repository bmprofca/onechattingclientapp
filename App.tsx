import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AuthScreen } from './src/screens/AuthScreen';
import { SplashScreen } from './src/components/SplashScreen';
import { WorkspaceScreen } from './src/screens/WorkspaceScreen';
import { ProjectPickerScreen } from './src/screens/ProjectPickerScreen';

import { getAccountProfile } from './src/api/auth';
import {
  Session,
  clearSession,
  loadSession,
  saveSession,
} from './src/services/session';
import { useTheme } from './src/theme/theme';
import { socketManager } from './src/services/socketManager';
import { notificationService } from './src/services/notificationService';
import { ScreenTransition } from './src/components/animations';

export default function App() {
  const theme = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  // Ref for notification tap → navigate to chat
  const notificationNavRef = useRef<
    ((contactNumber: string, contactName: string) => void) | null
  >(null);

  // Initialize notification service once
  useEffect(() => {
    const init = async () => {
      await notificationService.initialize();
      await notificationService.requestPermission();

      // Register tap handler — navigates to the chat when user taps notification
      notificationService.onNotificationTap((contactNumber, contactName) => {
        if (notificationNavRef.current) {
          notificationNavRef.current(contactNumber, contactName);
        }
      });
    };
    init().catch(console.warn);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        socketManager.ensureConnected();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

        if (
          !refreshed.selectedProjectId &&
          refreshed.projects &&
          refreshed.projects.length === 1
        ) {
          refreshed.selectedProjectId = refreshed.projects[0].id;
        }

        await saveSession(refreshed);
        setSession(refreshed);
        socketManager.connect(refreshed.token, refreshed.username);
        socketManager.setProjectId(refreshed.selectedProjectId);
        notificationService.startForegroundService();
      } catch {
        await clearSession();
        setSession(null);
        socketManager.disconnect();
        notificationService.stopForegroundService();
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
    socketManager.setProjectId(projectId);
  };

  const handleProjectCreated = async (newProject: {
    id: string;
    name: string;
  }) => {
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
        style={{ flex: 1, backgroundColor: statusBarColor }}
        edges={['top', 'bottom', 'left', 'right']}
      >
        {session === undefined ? (
          <SplashScreen />
        ) : !session ? (
          <ScreenTransition>
            <AuthScreen
              onAuthenticated={async authenticated => {
                let sessionToSave = authenticated;
                try {
                  const account = await getAccountProfile({
                    token: authenticated.token,
                    username: authenticated.username,
                  });
                  sessionToSave = {
                    ...sessionToSave,
                    ...account,
                    username: account.username || sessionToSave.username,
                  };
                } catch {
                  // ignore
                }
                if (
                  !sessionToSave.selectedProjectId &&
                  sessionToSave.projects &&
                  sessionToSave.projects.length === 1
                ) {
                  sessionToSave = {
                    ...sessionToSave,
                    selectedProjectId: sessionToSave.projects[0].id,
                  };
                }
                await saveSession(sessionToSave);
                setSession(sessionToSave);
                socketManager.connect(
                  sessionToSave.token,
                  sessionToSave.username,
                );
                socketManager.setProjectId(sessionToSave.selectedProjectId);
                notificationService.startForegroundService();
              }}
            />
          </ScreenTransition>
        ) : !session.selectedProjectId &&
          session.projects &&
          session.projects.length > 1 ? (
          <ScreenTransition>
            <ProjectPickerScreen
              projects={session.projects}
              onSelect={selectProject}
            />
          </ScreenTransition>
        ) : (
          <WorkspaceScreen
            session={session}
            onSelectProject={selectProject}
            onProjectCreated={handleProjectCreated}
            notificationNavRef={notificationNavRef}
            onSignOut={async () => {
              await clearSession();
              setSession(null);
              socketManager.disconnect();
              notificationService.stopForegroundService();
            }}
          />
        )}

        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Toast />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
