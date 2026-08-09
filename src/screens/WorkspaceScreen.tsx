import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { ArrowLeftRight, Home, MessageCircle, Megaphone, User, Wallet, MoreVertical, Briefcase, Info, HelpCircle } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { Session } from '../services/session';
import { useTheme } from '../theme/theme';
import { CampaignsScreen } from './CampaignsScreen';
import { CampaignDetailsScreen } from './CampaignDetailsScreen';
import { DashboardScreen } from './DashboardScreen';
import { LiveChatScreen } from './LiveChatScreen';
import { ChatRoomScreen } from './ChatRoomScreen';
import { ProfileScreen } from './ProfileScreen';
import { WalletScreen } from './WalletScreen';
import { WabaOnboardingScreen } from './WabaOnboardingScreen';
import { SupportScreen } from './SupportScreen';

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
  onOpenProjects,
  onSignOut,
}: {
  session: Session;
  onChooseProject: () => void;
  onOpenProjects: () => void;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const [page, setPage] = useState<Page>('dashboard');
  const [chatTarget, setChatTarget] = useState<{ number: string; name: string } | null>(null);
  const [campaignTarget, setCampaignTarget] = useState<{ id: string; name: string } | null>(null);
  const [walletTarget, setWalletTarget] = useState(false);
  const [wabaTarget, setWabaTarget] = useState(false);
  const [supportTarget, setSupportTarget] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const projectId = session.selectedProjectId || session.projects[0]?.id || '';
  const apiSession = useMemo<ApiSession>(
    () => ({ token: session.token, username: session.username }),
    [session.token, session.username],
  );

  const menuOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isMenuVisible) {
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      menuOpacity.setValue(0);
    }
  }, [isMenuVisible, menuOpacity]);

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
    if (walletTarget) {
      setWalletTarget(false);
      return true;
    }
    if (wabaTarget) {
      setWabaTarget(false);
      return true;
    }
    if (supportTarget) {
      setSupportTarget(false);
      return true;
    }
    if (page !== 'dashboard') {
      setPage('dashboard');
      return true;
    }
    return false; // nothing left to undo — let the system handle it (exit/bubble up)
  }, [chatTarget, campaignTarget, walletTarget, wabaTarget, supportTarget, page]);

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

  if (walletTarget) {
    return (
      <WalletScreen
        session={apiSession}
        balance={String(session.balance || '0')}
        onBack={() => setWalletTarget(false)}
      />
    );
  }

  if (wabaTarget) {
    return (
      <WabaOnboardingScreen
        session={apiSession}
        projectId={projectId}
        onBack={() => setWabaTarget(false)}
      />
    );
  }

  if (supportTarget) {
    return (
      <SupportScreen
        session={apiSession}
        onBack={() => setSupportTarget(false)}
      />
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.headerName, { color: theme.mintText }]}>1Chatting</Text>
          <Text style={[styles.greeting, { color: theme.muted }]}>Welcome to 1Chatting!</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Wallet"
            onPress={() => setWalletTarget(true)}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <Wallet size={20} color={theme.ink} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose another project"
            onPress={onChooseProject}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <ArrowLeftRight size={20} color={theme.ink} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            onPress={() => setIsMenuVisible(true)}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <MoreVertical size={20} color={theme.ink} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {page === 'dashboard' ? (
          <DashboardScreen
            session={apiSession}
            projectId={projectId}
            balance={String(session.balance || '0')}
            projectCount={session.projects?.length || session.projectCount || 0}
            onOpenInbox={() => setPage('inbox')}
            onOpenProfile={() => setPage('profile')}
            onOpenProjectsHub={onOpenProjects}
            onOpenWallet={() => setWalletTarget(true)}
            onOpenWaba={() => setWabaTarget(true)}
            onOpenSupport={() => setSupportTarget(true)}
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
                  color={active ? theme.emerald : theme.ink}
                  strokeWidth={active ? 2.5 : 2}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? theme.emerald : theme.ink },
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

      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <Pressable 
          style={styles.menuOverlay} 
          onPress={() => setIsMenuVisible(false)}
        >
          <Animated.View style={[
            styles.menuContent, 
            { 
              backgroundColor: theme.surface, 
              borderColor: theme.border,
              opacity: menuOpacity,
              transform: [
                {
                  translateY: menuOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-15, 0],
                  })
                },
                {
                  scale: menuOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  })
                }
              ]
            }
          ]}>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
              onPress={() => { setIsMenuVisible(false); onOpenProjects(); }}
            >
              <Briefcase size={18} color={theme.ink} />
              <Text style={[styles.menuItemText, { color: theme.ink }]}>Projects</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
              onPress={() => { setIsMenuVisible(false); setWabaTarget(true); }}
            >
              <Info size={18} color={theme.ink} />
              <Text style={[styles.menuItemText, { color: theme.ink }]}>WABA Info</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
              onPress={() => { setIsMenuVisible(false); setSupportTarget(true); }}
            >
              <HelpCircle size={18} color={theme.ink} />
              <Text style={[styles.menuItemText, { color: theme.ink }]}>Support</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    fontSize: 24,
    fontWeight: '900',
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContent: {
    position: 'absolute',
    top: 125,
    right: 5,
    width: 150,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
});