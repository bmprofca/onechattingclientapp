import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiSession } from '../api/client';
import { Session } from '../services/session';
import { colors } from '../theme/theme';
import { CampaignsScreen } from './CampaignsScreen';
import { DashboardScreen } from './DashboardScreen';
import { LiveChatScreen } from './LiveChatScreen';

type Page = 'dashboard' | 'inbox' | 'campaigns';

export function WorkspaceScreen({
  session,
  onChooseProject,
  onSignOut,
}: {
  session: Session;
  onChooseProject: () => void;
  onSignOut: () => void;
}) {
  const [page, setPage] = useState<Page>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const projectId = session.selectedProjectId || session.projects[0]?.id || '';
  const selectedProject = session.projects.find(
    project => project.id === projectId,
  );
  const apiSession = useMemo<ApiSession>(
    () => ({ token: session.token, username: session.username }),
    [session.token, session.username],
  );

  if (!projectId)
    return (
      <SafeAreaView style={styles.emptyScreen}>
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>1</Text>
        </View>
        <Text style={styles.emptyTitle}>No workspace yet</Text>
        <Text style={styles.emptyCopy}>
          Your account does not have an available project. Contact your
          administrator or sign in with a different account.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onSignOut}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Sign out</Text>
        </Pressable>
      </SafeAreaView>
    );

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMenuOpen(false);
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>1chatting</Text>
          <Text style={styles.headerName}>
            {selectedProject?.name || 'Workspace'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose another project"
            onPress={onChooseProject}
            style={styles.projectSwitchButton}
          >
            <Text style={styles.projectSwitchIcon}>⇄</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open workspace menu"
            onPress={() => setMenuOpen(open => !open)}
            style={styles.menuButton}
          >
            <Text style={styles.menuDots}>•••</Text>
          </Pressable>
        </View>
      </View>
      {menuOpen && (
        <>
          <Pressable
            accessibilityLabel="Close workspace menu"
            onPress={() => setMenuOpen(false)}
            style={styles.menuBackdrop}
          />
          <View style={styles.menu}>
            <Pressable
              onPress={() => navigate('inbox')}
              style={styles.menuItem}
            >
              <Text style={styles.menuItemText}>Live chat</Text>
            </Pressable>
            <Pressable
              onPress={() => navigate('campaigns')}
              style={styles.menuItem}
            >
              <Text style={styles.menuItemText}>Campaigns</Text>
            </Pressable>
            <Pressable
              onPress={() => navigate('dashboard')}
              style={styles.menuItem}
            >
              <Text style={styles.menuItemText}>Workspace dashboard</Text>
            </Pressable>
          </View>
        </>
      )}
      <View style={styles.body}>
        {page === 'dashboard' ? (
          <DashboardScreen
            projectId={projectId}
            projectName={selectedProject?.name || 'Workspace'}
            session={apiSession}
            onSignOut={onSignOut}
          />
        ) : page === 'inbox' ? (
          <LiveChatScreen projectId={projectId} session={apiSession} />
        ) : (
          <CampaignsScreen projectId={projectId} session={apiSession} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 12, color: colors.muted },
  headerName: {
    fontSize: 18,
    color: colors.ink,
    fontWeight: '800',
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projectSwitchButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  projectSwitchIcon: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.emerald,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  menuDots: {
    fontSize: 16,
    letterSpacing: 1,
    color: colors.emerald,
    fontWeight: '900',
    marginTop: -7,
  },
  body: { flex: 1 },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
  menu: {
    position: 'absolute',
    top: 98,
    right: 20,
    zIndex: 50,
    elevation: 12,
    width: 200,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  menuItem: { minHeight: 46, paddingHorizontal: 15, justifyContent: 'center' },
  menuItemText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: colors.canvas,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  emptyIconText: { fontSize: 30, fontWeight: '900', color: colors.emerald },
  emptyTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 20,
  },
  emptyCopy: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  primaryButton: {
    height: 50,
    minWidth: 145,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFF', fontWeight: '800' },
});
