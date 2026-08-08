import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeftRight, Home, MessageCircle, Megaphone, User } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { Session } from '../services/session';
import { useTheme } from '../theme/theme';
import { CampaignsScreen } from './CampaignsScreen';
import { CampaignDetailsScreen } from './CampaignDetailsScreen';
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

const TABS: { key: Page; label: string; icon: typeof Home }[] = [
  { key: 'dashboard', label: 'Home', icon: Home },
  { key: 'inbox', label: 'Chats', icon: MessageCircle },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'profile', label: 'Profile', icon: User },
];

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
  const [chatTarget, setChatTarget] = useState<{ number: string; name: string } | null>(null);
  const [campaignTarget, setCampaignTarget] = useState<{ id: string; name: string } | null>(null);
  const projectId = session.selectedProjectId || session.projects[0]?.id || '';
  const apiSession = useMemo<ApiSession>(
    () => ({ token: session.token, username: session.username }),
    [session.token, session.username],
  );

  // Hardware back button (Android) has no stack to pop by default since
  // "pages" here are just local state, not real navigation screens.
  // Without this, pressing back from an open chat, an open campaign, or a
  // non-home tab exits the whole app instead of stepping back one level.
  const handleBackPress = useCallback(() => {
    if (chatTarget) {
      setChatTarget(null);
      return true; // handled — stay in app
    }
    if (campaignTarget) {
      setCampaignTarget(null);
      return true;
    }
    if (page !== 'dashboard') {
      setPage('dashboard');
      return true;
    }
    return false; // nothing left to undo — let the system handle it (exit/bubble up)
  }, [chatTarget, campaignTarget, page]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

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

  // Chat room is rendered on its own, completely replacing the tab-bar
  // layout — full screen, like opening a chat thread in WhatsApp.
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

  // Campaign details is the same pattern — full screen, no tab bar.
  if (campaignTarget) {
    return (
      <CampaignDetailsScreen
        projectId={projectId}
        session={apiSession}
        campaignId={campaignTarget.id}
        campaignName={campaignTarget.name}
        onBack={() => setCampaignTarget(null)}
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
        </View>
      </View>

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
          <CampaignsScreen
            projectId={projectId}
            session={apiSession}
            onOpenCampaign={(campaignId, name) => setCampaignTarget({ id: campaignId, name })}
          />
        ) : (
          <ProfileScreen
            session={session}
            apiSession={apiSession}
            onSignOut={onSignOut}
          />
        )}
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = page === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              onPress={() => setPage(tab.key)}
              style={styles.tabItem}
              hitSlop={4}
            >
              <View style={[styles.tabPill, active && { backgroundColor: theme.mint }]}>
                <Icon
                  size={22}
                  color={active ? theme.emerald : theme.muted}
                  strokeWidth={active ? 2.5 : 2}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? theme.emerald : theme.muted },
                    active && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
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
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '800',
  },
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