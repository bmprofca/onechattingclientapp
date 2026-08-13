import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { ArrowLeftRight, Home, MessageCircle, Megaphone, User, Wallet, MoreVertical, Briefcase, Info, HelpCircle, Brain, Settings, ReceiptText } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { Session } from '../services/session';
import { useTheme } from '../theme/theme';
import { CampaignsScreen } from './CampaignsScreen';
import { CampaignDetailsScreen } from './CampaignDetailsScreen';
import { DashboardScreen } from './DashboardScreen';
import { LiveChatScreen } from './LiveChatScreen';
import { ChatRoomScreen } from './ChatRoomScreen';
import { ProfileScreen } from './ProfileScreen';
import { ProjectsScreen } from './ProjectsScreen';
import { WalletScreen } from './WalletScreen';
import { WabaOnboardingScreen } from './WabaOnboardingScreen';
import { SupportScreen } from './SupportScreen';
import { ContextConfigScreen } from './ContextConfigScreen';
import { ProjectConfigScreen } from './ProjectConfigScreen';
import { AgentConfigScreen } from './AgentConfigScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { AiBillsScreen } from './AiBillsScreen';
import { socketManager, ConnectionStatus } from '../services/socketManager';

type Page = 'dashboard' | 'inbox' | 'campaigns' | 'profile' | 'wallet' | 'projects';

const FULL_TABS: { key: Page; label: string; icon: typeof Home }[] = [
  { key: 'dashboard', label: 'Home', icon: Home },
  { key: 'inbox', label: 'Chats', icon: MessageCircle },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'profile', label: 'Profile', icon: User },
];

// Shown when the account has no workspace selected yet. Chats/Campaigns/
// Profile all depend on a project, so they're left out entirely rather
// than shown in a broken/empty state.
const LIMITED_TABS: { key: Page; label: string; icon: typeof Home }[] = [
  { key: 'dashboard', label: 'Home', icon: Home },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
  { key: 'projects', label: 'Projects', icon: Briefcase },
];

export function WorkspaceScreen({
  session,
  onSelectProject,
  onProjectCreated,
  onSignOut,
}: {
  session: Session;
  onSelectProject: (projectId: string) => void | Promise<void>;
  onProjectCreated: (newProject: { id: string; name: string }) => void | Promise<void>;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const projectId = session.selectedProjectId || '';
  const hasProject = !!projectId;

  const [page, setPage] = useState<Page>('dashboard');
  const [chatTarget, setChatTarget] = useState<{ number: string; name: string } | null>(null);
  const [campaignTarget, setCampaignTarget] = useState<{ id: string; name: string } | null>(null);
  const [walletTarget, setWalletTarget] = useState(false); // full-screen wallet, used from full mode
  const [wabaTarget, setWabaTarget] = useState(false);
  const [supportTarget, setSupportTarget] = useState(false);
  const [contextConfigTarget, setContextConfigTarget] = useState(false);
  const [projectConfigTarget, setProjectConfigTarget] = useState(false);
  const [agentConfigTarget, setAgentConfigTarget] = useState(false);
  const [transactionsTarget, setTransactionsTarget] = useState(false);
  const [aiBillsTarget, setAiBillsTarget] = useState(false);
  const [projectsTarget, setProjectsTarget] = useState(false); // full-screen projects hub, used from full mode
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const apiSession = useMemo<ApiSession>(
    () => ({ token: session.token, username: session.username }),
    [session.token, session.username],
  );

  // Only entering/leaving workspace mode resets the page. Switching between
  // projects keeps the current page mounted and its projectId-aware loaders
  // fetch the new workspace data.
  useEffect(() => {
    setPage('dashboard');
  }, [hasProject]);

  useEffect(() => {
    const unsub = socketManager.onConnectionChange(setConnectionStatus);
    return () => unsub();
  }, []);

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

  const handleBackPress = useCallback(() => {
    if (chatTarget) { setChatTarget(null); return true; }
    if (campaignTarget) { setCampaignTarget(null); return true; }
    if (walletTarget) { setWalletTarget(false); return true; }
    if (wabaTarget) { setWabaTarget(false); return true; }
    if (supportTarget) { setSupportTarget(false); return true; }
    if (contextConfigTarget) { setContextConfigTarget(false); return true; }
    if (agentConfigTarget) { setAgentConfigTarget(false); return true; }
    if (projectConfigTarget) { setProjectConfigTarget(false); return true; }
    if (transactionsTarget) { setTransactionsTarget(false); return true; }
    if (aiBillsTarget) { setAiBillsTarget(false); return true; }
    if (projectsTarget) { setProjectsTarget(false); return true; }
    if (page !== 'dashboard') { setPage('dashboard'); return true; }
    return false;
  }, [chatTarget, campaignTarget, walletTarget, wabaTarget, supportTarget, contextConfigTarget, agentConfigTarget, projectConfigTarget, transactionsTarget, projectsTarget, page]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  // ---- Full-screen overlays shared by both modes ----

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
    return <SupportScreen session={apiSession} onBack={() => setSupportTarget(false)} />;
  }

  if (contextConfigTarget) {
    return <ContextConfigScreen projectId={projectId} session={apiSession} onBack={() => { setContextConfigTarget(false); setProjectConfigTarget(true); }} />;
  }

  if (agentConfigTarget) {
    return <AgentConfigScreen projectId={projectId} session={apiSession} onBack={() => { setAgentConfigTarget(false); setProjectConfigTarget(true); }} />;
  }

  if (projectConfigTarget) {
    return <ProjectConfigScreen projectId={projectId} session={apiSession} onBack={() => setProjectConfigTarget(false)} onOpenAgent={() => { setProjectConfigTarget(false); setAgentConfigTarget(true); }} onOpenContext={() => { setProjectConfigTarget(false); setContextConfigTarget(true); }} />;
  }

  if (transactionsTarget) {
    return <TransactionsScreen session={apiSession} onBack={() => setTransactionsTarget(false)} />;
  }

  if (aiBillsTarget) {
    return <AiBillsScreen projectId={projectId} session={apiSession} onBack={() => setAiBillsTarget(false)} />;
  }

  // Full-mode "Projects" hub (create/manage/switch), reached from the menu.
  if (projectsTarget) {
    return (
      <ProjectsScreen
        session={apiSession}
        projects={session.projects || []}
        onSelect={async (id) => { await onSelectProject(id); setProjectsTarget(false); }}
        onProjectCreated={async (proj) => { await onProjectCreated(proj); await onSelectProject(proj.id); setProjectsTarget(false); }}
        onClose={() => setProjectsTarget(false)}
        onRechargeWallet={() => { setProjectsTarget(false); setWalletTarget(true); }}
      />
    );
  }

  const tabs = hasProject ? FULL_TABS : LIMITED_TABS;

  // In limited mode, the Wallet tab renders WalletScreen directly, which
  // already has its own header + back arrow — showing our own header on
  // top of it would just duplicate it, so we skip it for that one page.
  const showOuterHeader = hasProject || page !== 'wallet';

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {connectionStatus !== 'connected' && (
        <View style={{ backgroundColor: connectionStatus === 'connecting' ? '#F59E0B' : '#EF4444', padding: 4, alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Waiting for network...'}
          </Text>
        </View>
      )}
      {showOuterHeader && (
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <View style={styles.headerTitleGroup}>
            <View style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}>
              <View style={[styles.logo, { backgroundColor: theme.mint }]}>
                <Text style={[styles.logoText, { color: theme.mintText }]}>1</Text>
              </View>
              <Text style={[styles.logoText, { color: theme.mintText }]}>Chatting</Text>

            </View>
            {!hasProject &&
              <Text style={[styles.greeting, { color: theme.muted }]}>
                Set up your first workspace
              </Text>
            }
          </View>

          <View style={styles.headerActions}>
            {hasProject && (
              <>
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
                  onPress={() => setProjectsTarget(true)}
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
              </>
            )}
          </View>
        </View>
      )}

      <View style={styles.body}>
        {!hasProject ? (
          // ---- Limited mode: only Home / Wallet / Projects exist ----
          page === 'wallet' ? (
            <WalletScreen
              session={apiSession}
              balance={String(session.balance || '0')}
              onBack={() => setPage('dashboard')}
            />
          ) : page === 'projects' ? (
            <ProjectsScreen
              session={apiSession}
              projects={session.projects || []}
              onSelect={onSelectProject}
              onProjectCreated={async (proj) => { await onProjectCreated(proj); await onSelectProject(proj.id); }}
              onRechargeWallet={() => setPage('wallet')}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.noProjectPage} showsVerticalScrollIndicator={false}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.mint }]}>
                <Briefcase size={30} color={theme.emerald} strokeWidth={2} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.ink }]}>Welcome to 1Chatting</Text>
              <Text style={[styles.emptyCopy, { color: theme.muted }]}>
                You don't have a workspace yet. Create one to start chatting with your customers on WhatsApp.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPage('projects')}
                style={[styles.primaryButton, { backgroundColor: theme.emerald }]}
              >
                <Text style={styles.primaryButtonText}>Create a project</Text>
              </Pressable>
              <Pressable onPress={() => setPage('wallet')} style={styles.secondaryLink} hitSlop={8}>
                <Text style={[styles.secondaryLinkText, { color: theme.emerald }]}>Add funds to wallet</Text>
              </Pressable>
              <Pressable onPress={onSignOut} style={styles.secondaryLink} hitSlop={8}>
                <Text style={[styles.secondaryLinkText, { color: theme.muted }]}>Sign out</Text>
              </Pressable>
            </ScrollView>
          )
        ) : (
          // ---- Full mode: normal workspace experience ----
          page === 'dashboard' ? (
            <DashboardScreen
              session={apiSession}
              projectId={projectId}
              balance={String(session.balance || '0')}
              projectCount={session.projects?.length || session.projectCount || 0}
              onOpenInbox={() => setPage('inbox')}
              onOpenProfile={() => setPage('profile')}
              onOpenProjectsHub={() => setProjectsTarget(true)}
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
            <ProfileScreen session={session} apiSession={apiSession} onSignOut={onSignOut} />
          )
        )}
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.header, borderTopColor: theme.border }]}>
        {tabs.map(tab => {
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
              <View style={[styles.tabPill ]}>
                <Icon size={22} color={active ? theme.emerald : theme.ink} strokeWidth={active ? 2.5 : 2} />
                <Text style={[styles.tabLabel, { color: active ? theme.emerald : theme.ink }, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {hasProject && (
        <Modal visible={isMenuVisible} transparent animationType="none" onRequestClose={() => setIsMenuVisible(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setIsMenuVisible(false)}>
            <Animated.View style={[
              styles.menuContent,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: menuOpacity,
                transform: [
                  { translateY: menuOpacity.interpolate({ inputRange: [0, 1], outputRange: [-15, 0] }) },
                  { scale: menuOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                ],
              },
            ]}>
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
                onPress={() => { setIsMenuVisible(false); setProjectsTarget(true); }}
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
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
                onPress={() => { setIsMenuVisible(false); setProjectConfigTarget(true); }}
              >
                <Settings size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Configuration</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
                onPress={() => { setIsMenuVisible(false); setTransactionsTarget(true); }}
              >
                <ReceiptText size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Transactions</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
                onPress={() => { setIsMenuVisible(false); setContextConfigTarget(true); }}
              >
                <Brain size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>AI Context</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.cardHover }]}
                onPress={() => { setIsMenuVisible(false); setAiBillsTarget(true); }}
              >
                <ReceiptText size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>AI Bills</Text>
              </Pressable>

            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  logo: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 25, fontWeight: '900' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitleGroup: { justifyContent: 'center' },
  greeting: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  headerName: { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 64,
  },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  tabLabelActive: { fontWeight: '800' },

  noProjectPage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  primaryButton: {
    height: 48,
    minWidth: 200,
    marginTop: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  secondaryLink: { marginTop: 16, paddingVertical: 6, paddingHorizontal: 12 },
  secondaryLinkText: { fontSize: 14, fontWeight: '700' },

  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuContent: {
    position: 'absolute',
    top: 120,
    right: 5,
    width: 180,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemText: { fontSize: 15, fontWeight: '600' },
});
