import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { ArrowLeftRight, Home, MessageCircle, Megaphone, User, Wallet, MoreVertical, Briefcase, HelpCircle, Brain, Settings, ReceiptText, QrCode, FolderOpen } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import { getProjectMeta, getUnreadCount } from '../api/workspace';
import { Session, loadSession, saveSession } from '../services/session';
import { useTheme } from '../theme/theme';
import { CampaignsScreen } from './CampaignsScreen';
import { CampaignDetailsScreen } from './CampaignDetailsScreen';
import { CreateCampaignScreen } from './CreateCampaignScreen';
import { DashboardScreen } from './DashboardScreen';
import { LiveChatScreen } from './LiveChatScreen';
import { OpenCasesScreen } from './OpenCasesScreen';
import { ChatRoomScreen } from './ChatRoomScreen';
import { ProfileScreen } from './ProfileScreen';
import { ProjectsScreen } from './ProjectsScreen';
import { WalletScreen } from './WalletScreen';
import { WabaOnboardingScreen } from './WabaOnboardingScreen';
import { SupportScreen } from './SupportScreen';
import { ScannedUsersScreen } from './ScannedUsersScreen';
import { ContextConfigScreen } from './ContextConfigScreen';
import { ProjectConfigScreen } from './ProjectConfigScreen';
import { AgentConfigScreen } from './AgentConfigScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { AiBillsScreen } from './AiBillsScreen';
import { socketManager, ConnectionStatus } from '../services/socketManager';
import { notificationService } from '../services/notificationService';
import { ScalePressable, FadeInView } from '../components/animations';
import { Project } from '../api/auth';
import { ProjectAvatar } from '../components/ProjectAvatar';
import { ProjectQRModal } from '../components/Modals/ProjectQRModal';
import { WhatsAppNotificationBanner } from '../components/WhatsAppNotificationBanner';
import { formatImageUrl } from '../utils/imageUrl';

type Page = 'dashboard' | 'inbox' | 'cases' | 'campaigns' | 'profile' | 'wallet' | 'projects';

const FULL_TABS: { key: Page; label: string; icon: typeof Home }[] = [
  { key: 'dashboard', label: 'Home', icon: Home },
  { key: 'inbox', label: 'Chats', icon: MessageCircle },
  { key: 'cases', label: 'Cases', icon: FolderOpen },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
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
  notificationNavRef,
  onSignOut,
}: {
  session: Session;
  onSelectProject: (projectId: string) => void | Promise<void>;
  onProjectCreated: (newProject: { id: string; name: string }) => void | Promise<void>;
  notificationNavRef?: React.MutableRefObject<((contactNumber: string, contactName: string) => void) | null>;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const projectId = session.selectedProjectId || '';
  const hasProject = !!projectId;
  console.log('hasProject:', hasProject, 'projectId:', projectId, 'session.selectedProjectId:', session.selectedProjectId);

  const [page, setPage] = useState<Page>(hasProject ? 'inbox' : 'dashboard');
  const [walletBalance, setWalletBalance] = useState<number | string>(session.balance ?? 0);
  const [projectCount, setProjectCount] = useState<number>(session.projectCount ?? session.projects?.length ?? 0);
  const [projects, setProjects] = useState<Project[]>(session.projects || []);
  const [chatTarget, setChatTarget] = useState<{ number: string; name: string } | null>(null);
  const [campaignTarget, setCampaignTarget] = useState<{ id: string; name: string } | null>(null);
  const [createCampaignTarget, setCreateCampaignTarget] = useState(false);
  const [walletTarget, setWalletTarget] = useState(false); // full-screen wallet, used from full mode
  const [wabaTarget, setWabaTarget] = useState(false);
  const [supportTarget, setSupportTarget] = useState(false);
  const [contextConfigTarget, setContextConfigTarget] = useState(false);
  const [projectConfigTarget, setProjectConfigTarget] = useState(false);
  const [agentConfigTarget, setAgentConfigTarget] = useState(false);
  const [transactionsTarget, setTransactionsTarget] = useState(false);
  const [aiBillsTarget, setAiBillsTarget] = useState(false);
  const [projectsTarget, setProjectsTarget] = useState(false);
  const [profileTarget, setProfileTarget] = useState(false);
  const [scannedUsersTarget, setScannedUsersTarget] = useState(false); // full-screen projects hub, used from full mode
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [projectQrModalOpen, setProjectQrModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [projectProfileImage, setProjectProfileImage] = useState<string>('');
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (session.projects) {
      setProjects(session.projects);
    }
  }, [session.projects]);

  // Wire notification tap → navigate to chat
  useEffect(() => {
    if (notificationNavRef) {
      notificationNavRef.current = (contactNumber: string, contactName: string) => {
        setChatTarget({ number: contactNumber, name: contactName });
      };
    }
    return () => {
      if (notificationNavRef) {
        notificationNavRef.current = null;
      }
    };
  }, [notificationNavRef]);

  // Track active chat for notification suppression
  useEffect(() => {
    if (chatTarget) {
      notificationService.setActiveChat(chatTarget.number);
      // Cancel any existing notification for this contact
      notificationService.cancelNotificationsForContact(chatTarget.number);
    } else {
      notificationService.clearActiveChat();
    }
  }, [chatTarget]);

  const apiSession = useMemo<ApiSession>(
    () => ({ token: session.token, username: session.username }),
    [session.token, session.username],
  );

  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === projectId);
  }, [projects, projectId]);

  const handleBalanceUpdated = useCallback((bal: number) => {
    setWalletBalance(bal);
  }, []);

  // ---- Total unread count, used for the "Chats" tab badge ----
  const loadUnreadCount = useCallback(async () => {
    if (!hasProject || !projectId) {
      setTotalUnreadCount(0);
      return;
    }
    try {
      const res = await getUnreadCount(apiSession, projectId);
      const count =
        (res as any)?.data?.count ??
        (res as any)?.count ??
        (res as any)?.data?.unread_count ??
        (res as any)?.unread_count ??
        0;
      setTotalUnreadCount(Number(count) || 0);
    } catch {
      // ignore — badge just won't update this cycle
    }
  }, [apiSession, hasProject, projectId]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    // Live updates: server pushes the new total whenever a message is
    // read/received, so the badge stays correct even while sitting on
    // a different tab (e.g. Dashboard) than the chat list itself.
    const unsub = socketManager.onTotalUnreadCount((data) => {
      if (typeof data?.count === 'number') {
        setTotalUnreadCount(data.count);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProjectProfileImage('');
      return;
    }
    // Set initial from project if available, or immediately clear previous project image
    const initialImg =
      (currentProject as any)?.profile_image ||
      (currentProject as any)?.profile_picture ||
      (currentProject as any)?.logo ||
      (currentProject as any)?.image ||
      '';
    setProjectProfileImage(initialImg || '');

    let isMounted = true;
    getProjectMeta(apiSession, projectId)
      .then((res) => {
        if (!isMounted) return;
        const proj = res?.data?.project || res?.project || {};
        const prof = res?.data?.profile || res?.profile || {};
        const rawImg =
          proj.profile_image ||
          proj.profile_picture ||
          proj.profile_picture_url ||
          proj.profile_photo ||
          proj.photo ||
          proj.logo ||
          proj.image ||
          proj.avatar ||
          prof.profile_picture_url ||
          prof.profile_image ||
          prof.profile_picture ||
          prof.image ||
          res?.data?.profile_picture ||
          '';
        const img = formatImageUrl(rawImg);
        setProjectProfileImage(img || initialImg || '');
      })
      .catch(() => { });

    return () => {
      isMounted = false;
    };
  }, [apiSession.token, apiSession.username, projectId, currentProject?.id, (currentProject as any)?.profile_image, (currentProject as any)?.profile_picture, (currentProject as any)?.image, (currentProject as any)?.logo]);

  const refreshAccount = useCallback(async () => {
    try {
      const updated = await getAccountProfile(apiSession);
      if (updated.balance !== undefined) {
        setWalletBalance(updated.balance);
      }
      if (updated.projectCount !== undefined) {
        setProjectCount(updated.projectCount);
      }
      if (updated.projects && Array.isArray(updated.projects)) {
        setProjects(updated.projects);
      }
      const stored = await loadSession();
      if (stored) {
        const refreshed: Session = {
          ...stored,
          ...updated,
          selectedProjectId: stored.selectedProjectId,
        };
        await saveSession(refreshed);
      }
    } catch {
      // ignore
    }
  }, [apiSession.token, apiSession.username]);

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  useEffect(() => {
    setPage(hasProject ? 'inbox' : 'dashboard');
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
    if (createCampaignTarget) { setCreateCampaignTarget(false); return true; }
    if (walletTarget) { setWalletTarget(false); return true; }
    if (wabaTarget) { setWabaTarget(false); return true; }
    if (scannedUsersTarget) { setScannedUsersTarget(false); return true; }
    if (supportTarget) { setSupportTarget(false); return true; }
    if (contextConfigTarget) { setContextConfigTarget(false); return true; }
    if (agentConfigTarget) { setAgentConfigTarget(false); return true; }
    if (projectConfigTarget) { setProjectConfigTarget(false); return true; }
    if (transactionsTarget) { setTransactionsTarget(false); return true; }
    if (aiBillsTarget) { setAiBillsTarget(false); return true; }
    if (projectsTarget) { setProjectsTarget(false); return true; }
    if (profileTarget) { setProfileTarget(false); return true; }
    if (page !== 'dashboard') { setPage('dashboard'); return true; }
    return false;
  }, [chatTarget, campaignTarget, createCampaignTarget, walletTarget, wabaTarget, scannedUsersTarget, supportTarget, contextConfigTarget, agentConfigTarget, projectConfigTarget, transactionsTarget, aiBillsTarget, projectsTarget, profileTarget, page]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  // ---- Full-screen overlays shared by both modes ----

  if (chatTarget) {
    return (
      <View style={{ flex: 1 }}>
        <ChatRoomScreen
          projectId={projectId}
          session={apiSession}
          contactNumber={chatTarget.number}
          contactName={chatTarget.name}
          onBack={() => setChatTarget(null)}
        />
        <WhatsAppNotificationBanner
          currentChatNumber={chatTarget.number}
          onOpenChat={(contactNumber, contactName) => setChatTarget({ number: contactNumber, name: contactName })}
        />
      </View>
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

  if (createCampaignTarget) {
    return (
      <CreateCampaignScreen
        projectId={projectId}
        session={apiSession}
        onBack={() => setCreateCampaignTarget(false)}
        onCreated={() => {
          setCreateCampaignTarget(false);
          setPage('campaigns');
        }}
      />
    );
  }

  if (walletTarget) {
    return (
      <WalletScreen
        session={apiSession}
        balance={walletBalance ?? session.balance ?? 0}
        onBack={() => {
          setWalletTarget(false);
          refreshAccount();
        }}
        onBalanceUpdated={(bal) => setWalletBalance(bal)}
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

  if (scannedUsersTarget) {
    return <ScannedUsersScreen projectId={projectId} session={apiSession} onBack={() => setScannedUsersTarget(false)} />;
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
        projects={projects}
        currentProjectId={projectId}
        onSelect={async (id) => { await onSelectProject(id); setProjectsTarget(false); }}
        onProjectCreated={async (proj) => { await onProjectCreated(proj); await onSelectProject(proj.id); setProjectsTarget(false); }}
        onClose={() => setProjectsTarget(false)}
        onRechargeWallet={() => { setProjectsTarget(false); setWalletTarget(true); }}
        onOpenWaba={() => { setProjectsTarget(false); setWabaTarget(true); }}
      />
    );
  }

  if (profileTarget) {
    return (
      <ProfileScreen
        session={session}
        apiSession={apiSession}
        onSignOut={onSignOut}
        onBack={() => setProfileTarget(false)}
      />
    );
  }

  const tabs = hasProject ? FULL_TABS : LIMITED_TABS;

  // In limited mode, the Wallet and Projects tabs render their own screens
  // with their own headers — showing our own header on top of them would
  // just duplicate it, so we skip it for those pages.
  const showOuterHeader = hasProject || (page !== 'wallet' && page !== 'projects');

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
                <Text style={[styles.logoText, { color: theme.isDark ? '#ffffffff' : theme.mintText }]}>1</Text>
              </View>
              <Text style={[styles.logoText, { color: theme.isDark ? '#ffffffff' : theme.mintText }]}>Chatting</Text>

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
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Wallet"
                  onPress={() => setWalletTarget(true)}
                  style={styles.actionBtn}
                  hitSlop={8}
                >
                  <Wallet size={20} color={theme.ink} strokeWidth={2.5} />
                </ScalePressable>
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose another project"
                  onPress={() => setProjectsTarget(true)}
                  style={styles.projectSwitchBtn}
                  hitSlop={8}
                >
                  <View style={[styles.projectAvatarContainer, { borderColor: theme.emerald }]}>
                    <ProjectAvatar
                      name={currentProject?.name || 'P'}
                      image={projectProfileImage}
                      size={34}
                      borderRadius={17}
                    />
                    <View style={[styles.projectSwitchBadge, { backgroundColor: theme.emerald }]}>
                      <ArrowLeftRight size={8} color="#FFF" strokeWidth={3} />
                    </View>
                  </View>
                </ScalePressable>
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                  onPress={() => setIsMenuVisible(true)}
                  style={styles.actionBtn}
                  hitSlop={8}
                >
                  <MoreVertical size={20} color={theme.ink} strokeWidth={2.5} />
                </ScalePressable>
              </>
            )}
          </View>
        </View>
      )}

      <View style={styles.body}>
        <FadeInView key={hasProject ? page : `limited-${page}`} duration={220} distance={6} style={{ flex: 1 }}>
          {!hasProject ? (
            // ---- Limited mode: only Home / Wallet / Projects exist ----
            page === 'wallet' ? (
              <WalletScreen
                session={apiSession}
                balance={walletBalance ?? session.balance ?? 0}
                onBack={() => {
                  setPage('dashboard');
                  refreshAccount();
                }}
                onBalanceUpdated={(bal) => setWalletBalance(bal)}
              />
            ) : page === 'projects' ? (
              <ProjectsScreen
                session={apiSession}
                projects={projects}
                onSelect={onSelectProject}
                onProjectCreated={async (proj) => { await onProjectCreated(proj); await onSelectProject(proj.id); }}
                onRechargeWallet={() => setPage('wallet')}
                onClose={() => setPage('dashboard')}
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
                <ScalePressable
                  accessibilityRole="button"
                  onPress={() => setPage('projects')}
                  style={[styles.primaryButton, { backgroundColor: theme.emerald }]}
                >
                  <Text style={styles.primaryButtonText}>Create a project</Text>
                </ScalePressable>
                <ScalePressable onPress={() => setPage('wallet')} style={styles.secondaryLink} hitSlop={8}>
                  <Text style={[styles.secondaryLinkText, { color: theme.emerald }]}>Add funds to wallet</Text>
                </ScalePressable>
                <ScalePressable
                  accessibilityRole="button"
                  onPress={onSignOut}
                  style={[styles.logoutButton, { backgroundColor: theme.isDark ? theme.danger : theme.dangerBg, borderColor: theme.isDark ? theme.danger : theme.dangerBorder }]}
                >
                  <Text style={[styles.logoutButtonText, { color: '#FFFFFF' }]}>Log Out</Text>
                </ScalePressable>
              </ScrollView>
            )
          ) : (
            // ---- Full mode: normal workspace experience ----
            page === 'dashboard' ? (
              <DashboardScreen
                session={apiSession}
                projectId={projectId}
                balance={walletBalance ?? session.balance ?? 0}
                projectCount={projectCount || session.projects?.length || session.projectCount || 0}
                onBalanceUpdated={(bal) => setWalletBalance(bal)}
                onOpenInbox={() => setPage('inbox')}
                onOpenProfile={() => setProfileTarget(true)}
                onOpenProjectsHub={() => setProjectsTarget(true)}
                onOpenWallet={() => setWalletTarget(true)}
                onOpenSupport={() => setSupportTarget(true)}
                onOpenScannedUsers={() => setScannedUsersTarget(true)}
              />
            ) : page === 'inbox' ? (
              <LiveChatScreen
                projectId={projectId}
                session={apiSession}
                onOpenChat={(contactNumber, contactName) => setChatTarget({ number: contactNumber, name: contactName })}
              />
            ) : page === 'cases' ? (
              <OpenCasesScreen
                projectId={projectId}
                session={apiSession}
                onOpenChat={(contactNumber, contactName) => setChatTarget({ number: contactNumber, name: contactName })}
              />
            ) : page === 'campaigns' ? (
              <CampaignsScreen
                projectId={projectId}
                session={apiSession}
                onOpenCampaign={(campaignId, name) => setCampaignTarget({ id: campaignId, name })}
                onCreateCampaign={() => setCreateCampaignTarget(true)}
              />
            ) : null
          )}
        </FadeInView>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.header, borderTopColor: theme.border }]}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = page === tab.key;
          const showBadge = tab.key === 'inbox' && totalUnreadCount > 0;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={showBadge ? `${tab.label}, ${totalUnreadCount} unread` : tab.label}
              onPress={() => setPage(tab.key)}
              style={styles.tabItem}
              hitSlop={4}
            >
              <View
                style={[
                  styles.tabPill,
                  active && {
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(11, 205, 21, 0.09)',borderRadius:12
                  },
                ]}
              >
                <View style={styles.tabIconWrap}>
                  <Icon size={22} color={active ? theme.emerald : theme.ink} strokeWidth={active ? 2.5 : 2} />
                  {showBadge && (
                    <View style={[styles.tabBadge, { backgroundColor: theme.emerald, borderColor: theme.header }]}>
                      <Text style={styles.tabBadgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                    </View>
                  )}
                </View>
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
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setProjectQrModalOpen(true); }}
              >
                <QrCode size={18} color={theme.emerald} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Project QR Code</Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setProjectsTarget(true); }}
              >
                <Briefcase size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Projects</Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setSupportTarget(true); }}
              >
                <HelpCircle size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Support</Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setProjectConfigTarget(true); }}
              >
                <Settings size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Configuration</Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setTransactionsTarget(true); }}
              >
                <ReceiptText size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Transactions</Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setContextConfigTarget(true); }}
              >
                <Brain size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>AI Context</Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setAiBillsTarget(true); }}
              >
                <ReceiptText size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>AI Bills</Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => { setIsMenuVisible(false); setProfileTarget(true); }}
              >
                <User size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>Profile</Text>
              </ScalePressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* Project QR Code Modal */}
      {hasProject && projectId && projectQrModalOpen && (
        <ProjectQRModal
          visible={projectQrModalOpen}
          onClose={() => setProjectQrModalOpen(false)}
          session={apiSession}
          projectId={projectId}
          projectName={currentProject?.name || 'Current Project'}
          projectImage={projectProfileImage}
        />
      )}

      {/* WhatsApp In-App Notification Banner */}
      <WhatsAppNotificationBanner
        currentChatNumber={null}
        onOpenChat={(contactNumber, contactName) => setChatTarget({ number: contactNumber, name: contactName })}
      />
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  projectSwitchBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectAvatarContainer: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  projectAvatarFallback: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectAvatarInitial: {
    fontSize: 15,
    fontWeight: '800',
  },
  projectSwitchBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
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
  tabIconWrap: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
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
  logoutButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    borderWidth: 1,
    paddingHorizontal: 80,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});