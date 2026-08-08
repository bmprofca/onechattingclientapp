import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeftRight, MoreVertical } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { Session } from '../services/session';
import { useTheme } from '../theme/theme';
import { CampaignsScreen } from './CampaignsScreen';
import { DashboardScreen } from './DashboardScreen';
import { LiveChatScreen } from './LiveChatScreen';
import { ChatRoomScreen } from './ChatRoomScreen';
import { ProfileScreen } from './ProfileScreen';

type Page = 'dashboard' | 'inbox' | 'campaigns' | 'profile';
const pageTitles: Record<Page, string> = {
  dashboard: 'Workspace',
  inbox: 'Live chat',
  campaigns: 'Campaigns',
  profile: 'My Profile',
};

export function WorkspaceScreen({
  session,
  onChooseProject,
  onSignOut,
}: {
  session: Session;
  onChooseProject: () => void;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const [page, setPage] = useState<Page>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ number: string; name: string } | null>(null);
  const projectId = session.selectedProjectId || session.projects[0]?.id || '';
  const apiSession = useMemo<ApiSession>(
    () => ({ token: session.token, username: session.username }),
    [session.token, session.username],
  );

  if (!projectId)
    return (
      <View style={[styles.emptyScreen, { backgroundColor: theme.canvas }]}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.mint }]}>
          <Text style={[styles.emptyIconText, { color: theme.emerald }]}>1</Text>
        </View>
        <Text style={[styles.emptyTitle, { color: theme.ink }]}>No workspace yet</Text>
        <Text style={[styles.emptyCopy, { color: theme.muted }]}>
          Your account does not have an available project. Contact your
          administrator or sign in with a different account.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onSignOut}
          style={[styles.primaryButton, { backgroundColor: theme.emerald }]}
        >
          <Text style={styles.primaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    );

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMenuOpen(false);
    setChatTarget(null);
  };

  if (chatTarget) {
    return (
      <ChatRoomScreen
        projectId={projectId}
        session={apiSession}
        contactNumber={chatTarget.number}
        contactName={chatTarget.name}
        onBack={() => setChatTarget(null)}
      />
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.greeting, { color: theme.muted }]}>1chatting</Text>
          <Text style={[styles.headerName, { color: theme.ink }]}>{pageTitles[page]}</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose another project"
            onPress={onChooseProject}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <ArrowLeftRight size={20} color={theme.mintText} strokeWidth={2.5} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open workspace menu"
            onPress={() => setMenuOpen(open => !open)}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <MoreVertical size={20} color={theme.mintText} strokeWidth={2.5} />
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
          <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              onPress={() => navigate('dashboard')}
              style={[styles.menuItem, page === 'dashboard' && { backgroundColor: theme.cardHover }]}
            >
              <Text style={[styles.menuItemText, { color: theme.ink }]}> dashboard</Text>
            </Pressable>
            <Pressable
              onPress={() => navigate('inbox')}
              style={[styles.menuItem, page === 'inbox' && { backgroundColor: theme.cardHover }]}
            >
              <Text style={[styles.menuItemText, { color: theme.ink }]}>Live chat</Text>
            </Pressable>
            <Pressable
              onPress={() => navigate('campaigns')}
              style={[styles.menuItem, page === 'campaigns' && { backgroundColor: theme.cardHover }]}
            >
              <Text style={[styles.menuItemText, { color: theme.ink }]}>Campaigns</Text>
            </Pressable>
            <Pressable
              onPress={() => navigate('profile')}
              style={[styles.menuItem, page === 'profile' && { backgroundColor: theme.cardHover }]}
            >
              <Text style={[styles.menuItemText, { color: theme.ink }]}>My Profile</Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.body}>
        {page === 'dashboard' ? (
          <DashboardScreen
            projectId={projectId}
            session={apiSession}
            onOpenProfile={() => setPage('profile')}
          />
        ) : page === 'inbox' ? (
          <LiveChatScreen 
            projectId={projectId} 
            session={apiSession} 
            onOpenChat={(contactNumber, contactName) => setChatTarget({ number: contactNumber, name: contactName })}
          />
        ) : page === 'campaigns' ? (
          <CampaignsScreen projectId={projectId} session={apiSession} />
        ) : (
          <ProfileScreen
            session={session}
            apiSession={apiSession}
            onSignOut={onSignOut}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    justifyContent: 'center',
  },
  greeting: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  headerName: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    top: 64,
    right: 16,
    zIndex: 50,
    elevation: 12,
    width: 210,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  menuItemText: { fontSize: 14, fontWeight: '700' },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: { fontSize: 32, fontWeight: '900' },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 20,
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  primaryButton: {
    height: 48,
    minWidth: 145,
    marginTop: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});