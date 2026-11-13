import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { ArrowLeftRight, ChevronDown, Home, MessageCircle, Megaphone, User, Wallet, MoreVertical, Briefcase, HelpCircle, Brain, Settings, ReceiptText, QrCode, FolderOpen, Users, FileText } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import { getProjectMeta, getUnreadCount } from '../api/workspace';
import { Session, loadSession, saveSession } from '../services/session';
import { useTheme, radii } from '../theme/theme';
import { CampaignsScreen } from './CampaignsScreen';
import { CampaignDetailsScreen } from './CampaignDetailsScreen';
import { CreateCampaignScreen } from './CreateCampaignScreen';
import { NewChatScreen } from './NewChatScreen';
import { CreateCaseScreen } from './CreateCaseScreen';
import { CaseDetailsScreen } from './CaseDetailsScreen';
import { EditCaseScreen } from './EditCaseScreen';
import { DashboardScreen } from './DashboardScreen';
import { ChatFilterType, LiveChatScreen } from './LiveChatScreen';
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
import { FlowBuilderScreen } from './FlowBuilderScreen';
import { FlowLibraryScreen } from './FlowLibraryScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { AiBillsScreen } from './AiBillsScreen';
import { ContactsScreen } from './ContactsScreen';
import { GroupsScreen } from './GroupsScreen';
import { GroupDetailsScreen } from './GroupDetailsScreen';
import { TemplatesScreen } from './TemplatesScreen';
import { TemplateEditorScreen } from './TemplateEditorScreen';
import { socketManager } from '../services/socketManager';
import { notificationService } from '../services/notificationService';
import type { NotificationTarget } from '../services/notificationTarget';
import Toast from '../ui/toast';
import {
  ScalePressable,
  FadeInView,
  StackScreen,
  STACK_ENTER_DURATION,
} from '../components/animations';
import { Project } from '../api/auth';
import { BrandMark } from '../components/BrandMark';
import { ProjectAvatar } from '../components/ProjectAvatar';
import { ProjectQRModal } from '../components/Modals/ProjectQRModal';
import { formatImageUrl } from '../utils/imageUrl';
import { useKeyboardContext } from '../contexts/KeyboardContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'P';
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[1].charAt(0) : parts[0].charAt(1);
  return `${first}${second || ''}`.toUpperCase();
}

type Page =
  | 'dashboard'
  | 'inbox'
  | 'cases'
  | 'campaigns'
  | 'profile'
  | 'wallet'
  | 'projects';

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
  onProjectCreated: (newProject: {
    id: string;
    name: string;
  }) => void | Promise<void>;
  notificationNavRef?: React.MutableRefObject<
    ((target: NotificationTarget) => void) | null
  >;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboardContext();
  const projectId = session.selectedProjectId || '';
  const hasProject = !!projectId;
  console.log(
    'hasProject:',
    hasProject,
    'projectId:',
    projectId,
    'session.selectedProjectId:',
    session.selectedProjectId,
  );

  const [page, setPage] = useState<Page>(hasProject ? 'inbox' : 'dashboard');
  const [inboxFilter, setInboxFilter] = useState<ChatFilterType | undefined>();
  const [walletBalance, setWalletBalance] = useState<number | string>(
    session.balance ?? 0,
  );
  const [projectCount, setProjectCount] = useState<number>(
    session.projectCount ?? session.projects?.length ?? 0,
  );
  const [projects, setProjects] = useState<Project[]>(session.projects || []);
  const [chatTarget, setChatTarget] = useState<{
    number: string;
    name: string;
  } | null>(null);
  const [campaignTarget, setCampaignTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [createCampaignTarget, setCreateCampaignTarget] = useState(false);
  const [newChatTarget, setNewChatTarget] = useState(false);
  const [createCaseTarget, setCreateCaseTarget] = useState<{ name?: string; number: string } | boolean | null>(null);
  const [caseDetailsTarget, setCaseDetailsTarget] = useState<{
    number: string;
    name?: string;
    caseName?: string;
  } | null>(null);
  const [editCaseTarget, setEditCaseTarget] = useState<{ caseItem: any; returnToDetails?: boolean } | null>(null);
  const [casesTarget, setCasesTarget] = useState(false);
  const [walletTarget, setWalletTarget] = useState(false); // full-screen wallet, used from full mode
  const [wabaTarget, setWabaTarget] = useState<string | boolean | null>(null);
  const [supportTarget, setSupportTarget] = useState(false);
  const [contextConfigTarget, setContextConfigTarget] = useState(false);
  const [projectConfigTarget, setProjectConfigTarget] = useState(false);
  const [agentConfigTarget, setAgentConfigTarget] = useState(false);
  const [flowBuilderTarget, setFlowBuilderTarget] = useState(false);
  const [flowLibraryTarget, setFlowLibraryTarget] = useState(false);
  const [flowToOpen, setFlowToOpen] = useState<string | undefined>();
  const [transactionsTarget, setTransactionsTarget] = useState(false);
  const [aiBillsTarget, setAiBillsTarget] = useState(false);
  const [projectsTarget, setProjectsTarget] = useState(false);
  const [profileTarget, setProfileTarget] = useState(false);
  const [scannedUsersTarget, setScannedUsersTarget] = useState(false); // full-screen projects hub, used from full mode
  const [contactsTarget, setContactsTarget] = useState(false);
  const [groupsTarget, setGroupsTarget] = useState(false);
  const [groupDetailsTarget, setGroupDetailsTarget] = useState<any>(null);
  const [groupDetailsPrevious, setGroupDetailsPrevious] = useState<'groups' | 'contacts'>('groups');
  const [templatesTarget, setTemplatesTarget] = useState(false);
  const [templateEditorTarget, setTemplateEditorTarget] = useState<any>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const menuButtonRef = useRef<View>(null);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0 });
  const [projectQrModalOpen, setProjectQrModalOpen] = useState(false);
  const [projectProfileImage, setProjectProfileImage] = useState<string>('');
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (session.projects && session.projects.length > 0) {
      setProjects(session.projects);
    }
  }, [session.projects]);

  // Wire notification tap → navigate to chat
  useEffect(() => {
    if (notificationNavRef) {
      notificationNavRef.current = (target: NotificationTarget) => {
        const openTarget = async () => {
          if (target.projectId !== projectId) {
            if (!projects.some(item => String(item.id) === target.projectId)) {
              Toast.show({
                type: 'error',
                text1: 'Project unavailable',
                text2: 'This notification belongs to a project you can no longer access.',
              });
              return;
            }

            try {
              await onSelectProject(target.projectId);
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Could not switch project',
                text2: error instanceof Error ? error.message : String(error),
              });
              return;
            }
          }

          switch (target.type) {
            case 'conversation':
              setPage('inbox');
              setChatTarget({
                number: target.contactNumber,
                name: target.contactName,
              });
              break;
            case 'case':
              setPage('cases');
              setCaseDetailsTarget({
                number: target.contactNumber,
                name: target.contactName,
                caseName: target.caseName,
              });
              break;
            case 'campaign':
              setPage('campaigns');
              setCampaignTarget({
                id: target.campaignId,
                name: target.campaignName,
              });
              break;
          }
        };

        openTarget().catch(error => {
          Toast.show({
            type: 'error',
            text1: 'Could not open chat',
            text2: error instanceof Error ? error.message : String(error),
          });
        });
      };
    }
    return () => {
      if (notificationNavRef) {
        notificationNavRef.current = null;
      }
    };
  }, [notificationNavRef, onSelectProject, projectId, projects]);

  // Track active chat for notification suppression
  useEffect(() => {
    if (chatTarget) {
      notificationService.setActiveChat(chatTarget.number, projectId);
      // Cancel any existing notification for this contact
      notificationService.cancelNotificationsForContact(chatTarget.number);
    } else {
      notificationService.clearActiveChat();
    }
  }, [chatTarget, projectId]);

  const apiSession = useMemo<ApiSession>(
    () => ({ token: session.token, username: session.username }),
    [session.token, session.username],
  );

  const currentProject = useMemo(() => {
    return projects.find(p => String(p.id) === String(projectId));
  }, [projects, projectId]);
  // Name reported by the project-details API; used when the cached
  // project list doesn't contain the selected project.
  const [projectMetaName, setProjectMetaName] = useState('');
  const projectName = currentProject?.name || projectMetaName;

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
    } catch (error) {
      console.warn('Failed to load unread count:', error);
    }
  }, [apiSession, hasProject, projectId]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    // Live updates: server pushes the new total whenever a message is
    // read/received, so the badge stays correct even while sitting on
    // a different tab (e.g. Dashboard) than the chat list itself.
    const unsub = socketManager.onTotalUnreadCount(data => {
      if (typeof data?.count === 'number') {
        setTotalUnreadCount(data.count);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setProjectMetaName('');
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
      .then(res => {
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
        const metaName =
          proj.name || proj.project_name || proj.title || prof.name || prof.business_name || '';
        if (metaName) setProjectMetaName(String(metaName));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [
    apiSession.token,
    apiSession.username,
    projectId,
    currentProject?.id,
    (currentProject as any)?.profile_image,
    (currentProject as any)?.profile_picture,
    (currentProject as any)?.image,
    (currentProject as any)?.logo,
  ]);

  const refreshAccount = useCallback(async () => {
    try {
      const updated = await getAccountProfile(apiSession);
      if (updated.balance !== undefined) {
        setWalletBalance(updated.balance);
      }
      if (updated.projectCount !== undefined) {
        setProjectCount(updated.projectCount);
      }
      // Only replace the list when the server actually returned projects —
      // the profile endpoint sometimes sends just a count, which would wipe
      // the list and blank the workspace name in the header.
      if (Array.isArray(updated.projects) && updated.projects.length > 0) {
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

  const menuOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isMenuVisible) {
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else {
      menuOpacity.setValue(0);
    }
  }, [isMenuVisible, menuOpacity]);

  // ---- Stack navigation ----------------------------------------------------
  // Sub-screens are rendered as absolutely-filled StackScreen layers over the
  // tab UI, so they slide in/out instead of popping. The order below is the
  // z-order (bottom → top); hardware back closes the top-most open layer.
  // Clearing a target only starts the exit animation — StackScreen keeps the
  // last target cached until the screen has slid out.
  const closeAfterCoverTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => closeAfterCoverTimers.current.forEach(clearTimeout),
    [],
  );
  // "Replace" navigation: the new screen slides in on top, and the old one
  // is dismissed once it's fully covered (so it doesn't slide out visibly
  // underneath the incoming screen).
  const closeAfterCover = useCallback((close: () => void) => {
    const t = setTimeout(close, STACK_ENTER_DURATION + 40);
    closeAfterCoverTimers.current.push(t);
  }, []);

  // Keys used to remount a parent screen when a child that may have changed
  // its data is popped (previously the parent was remounted on return).
  const [templatesKey, setTemplatesKey] = useState(0);
  const [flowLibraryKey, setFlowLibraryKey] = useState(0);
  const [groupListsKey, setGroupListsKey] = useState(0);

  const stackOrder: { open: boolean; close: () => void }[] = [
    { open: projectsTarget, close: () => setProjectsTarget(false) },
    { open: profileTarget, close: () => setProfileTarget(false) },
    {
      open: walletTarget,
      close: () => {
        setWalletTarget(false);
        refreshAccount();
      },
    },
    { open: !!wabaTarget, close: () => setWabaTarget(null) },
    { open: transactionsTarget, close: () => setTransactionsTarget(false) },
    { open: aiBillsTarget, close: () => setAiBillsTarget(false) },
    { open: supportTarget, close: () => setSupportTarget(false) },
    { open: scannedUsersTarget, close: () => setScannedUsersTarget(false) },
    { open: projectConfigTarget, close: () => setProjectConfigTarget(false) },
    { open: contextConfigTarget, close: () => setContextConfigTarget(false) },
    { open: agentConfigTarget, close: () => setAgentConfigTarget(false) },
    { open: flowLibraryTarget, close: () => setFlowLibraryTarget(false) },
    {
      open: flowBuilderTarget,
      close: () => {
        setFlowBuilderTarget(false);
        setFlowLibraryKey(k => k + 1);
      },
    },
    { open: templatesTarget, close: () => setTemplatesTarget(false) },
    { open: !!templateEditorTarget, close: () => setTemplateEditorTarget(null) },
    { open: contactsTarget, close: () => setContactsTarget(false) },
    { open: groupsTarget, close: () => setGroupsTarget(false) },
    {
      open: !!groupDetailsTarget,
      close: () => {
        setGroupDetailsTarget(null);
        setGroupListsKey(k => k + 1);
      },
    },
    { open: casesTarget, close: () => setCasesTarget(false) },
    { open: !!caseDetailsTarget, close: () => setCaseDetailsTarget(null) },
    { open: !!createCaseTarget, close: () => setCreateCaseTarget(null) },
    { open: !!editCaseTarget, close: () => setEditCaseTarget(null) },
    { open: !!campaignTarget, close: () => setCampaignTarget(null) },
    { open: createCampaignTarget, close: () => setCreateCampaignTarget(false) },
    { open: newChatTarget, close: () => setNewChatTarget(false) },
    { open: !!chatTarget, close: () => setChatTarget(null) },
  ];
  const stackOrderRef = useRef(stackOrder);
  stackOrderRef.current = stackOrder;

  const handleBackPress = useCallback(() => {
    const layers = stackOrderRef.current;
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].open) {
        layers[i].close();
        return true;
      }
    }
    if (page !== 'dashboard') {
      setPage('dashboard');
      return true;
    }
    return false;
  }, [page]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => subscription.remove();
  }, [handleBackPress]);

  // The tab content now stays mounted under sub-screens. It used to be
  // remounted (and so refreshed) when the last sub-screen closed; keep that
  // by bumping its key when every non-chat layer has been dismissed.
  const anySubScreenOpen = stackOrder.some(
    (l, i) => l.open && i !== stackOrder.length - 1,
  );
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
  const prevSubScreenOpen = useRef(anySubScreenOpen);
  useEffect(() => {
    if (prevSubScreenOpen.current && !anySubScreenOpen) {
      setTabRefreshKey(k => k + 1);
    }
    prevSubScreenOpen.current = anySubScreenOpen;
  }, [anySubScreenOpen]);

  const layerStyle = (z: number) => ({ zIndex: 20 + z, elevation: 20 + z });
  const cardStyle = { backgroundColor: theme.canvas };

  const stackLayers = (
    <>
      <StackScreen
        item={projectsTarget}
        onRequestClose={stackOrder[0].close}
        style={layerStyle(0)}
        contentStyle={cardStyle}
      >
        {() => (
          <ProjectsScreen
            session={apiSession}
            projects={projects}
            currentProjectId={projectId}
            onSelect={async id => {
              await onSelectProject(id);
              setProjectsTarget(false);
            }}
            onProjectCreated={async proj => {
              await onProjectCreated(proj);
              await onSelectProject(proj.id);
              setProjectsTarget(false);
            }}
            onClose={() => setProjectsTarget(false)}
            onRechargeWallet={() => {
              setWalletTarget(true);
              closeAfterCover(() => setProjectsTarget(false));
            }}
            onOpenWaba={targetId => {
              setWabaTarget(targetId || projectId);
              closeAfterCover(() => setProjectsTarget(false));
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={profileTarget}
        onRequestClose={stackOrder[1].close}
        style={layerStyle(1)}
        contentStyle={cardStyle}
      >
        {() => (
          <ProfileScreen
            session={session}
            apiSession={apiSession}
            onSignOut={onSignOut}
            onBack={() => setProfileTarget(false)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={walletTarget}
        onRequestClose={stackOrder[2].close}
        style={layerStyle(2)}
        contentStyle={cardStyle}
      >
        {() => (
          <WalletScreen
            session={apiSession}
            balance={walletBalance ?? session.balance ?? 0}
            onBack={() => {
              setWalletTarget(false);
              refreshAccount();
            }}
            onBalanceUpdated={bal => setWalletBalance(bal)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={wabaTarget}
        onRequestClose={stackOrder[3].close}
        style={layerStyle(3)}
        contentStyle={cardStyle}
      >
        {target => {
          const targetProjectId =
            typeof target === 'string' ? target : projectId;
          const targetProjectName = projects.find(
            p => p.id === targetProjectId,
          )?.name;
          return (
            <WabaOnboardingScreen
              session={apiSession}
              projectId={targetProjectId}
              projectName={targetProjectName}
              onBack={() => setWabaTarget(null)}
            />
          );
        }}
      </StackScreen>

      <StackScreen
        item={transactionsTarget}
        onRequestClose={stackOrder[4].close}
        style={layerStyle(4)}
        contentStyle={cardStyle}
      >
        {() => (
          <TransactionsScreen
            session={apiSession}
            onBack={() => setTransactionsTarget(false)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={aiBillsTarget}
        onRequestClose={stackOrder[5].close}
        style={layerStyle(5)}
        contentStyle={cardStyle}
      >
        {() => (
          <AiBillsScreen
            projectId={projectId}
            session={apiSession}
            onBack={() => setAiBillsTarget(false)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={supportTarget}
        onRequestClose={stackOrder[6].close}
        style={layerStyle(6)}
        contentStyle={cardStyle}
      >
        {() => (
          <SupportScreen
            session={apiSession}
            onBack={() => setSupportTarget(false)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={scannedUsersTarget}
        onRequestClose={stackOrder[7].close}
        style={layerStyle(7)}
        contentStyle={cardStyle}
      >
        {() => (
          <ScannedUsersScreen
            projectId={projectId}
            session={apiSession}
            onBack={() => setScannedUsersTarget(false)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={projectConfigTarget}
        onRequestClose={stackOrder[8].close}
        style={layerStyle(8)}
        contentStyle={cardStyle}
      >
        {() => (
          <ProjectConfigScreen
            projectId={projectId}
            session={apiSession}
            onBack={() => setProjectConfigTarget(false)}
            onOpenAgent={() => setAgentConfigTarget(true)}
            onOpenContext={() => setContextConfigTarget(true)}
            onOpenFlow={() => setFlowLibraryTarget(true)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={contextConfigTarget}
        onRequestClose={stackOrder[9].close}
        style={layerStyle(9)}
        contentStyle={cardStyle}
      >
        {() => (
          <ContextConfigScreen
            projectId={projectId}
            session={apiSession}
            onBack={() => setContextConfigTarget(false)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={agentConfigTarget}
        onRequestClose={stackOrder[10].close}
        style={layerStyle(10)}
        contentStyle={cardStyle}
      >
        {() => (
          <AgentConfigScreen
            projectId={projectId}
            session={apiSession}
            onBack={() => setAgentConfigTarget(false)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={flowLibraryTarget}
        onRequestClose={stackOrder[11].close}
        style={layerStyle(11)}
        contentStyle={cardStyle}
      >
        {() => (
          <FlowLibraryScreen
            key={flowLibraryKey}
            projectId={projectId}
            session={apiSession}
            onBack={() => setFlowLibraryTarget(false)}
            onOpenFlow={id => {
              setFlowToOpen(id);
              setFlowBuilderTarget(true);
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={flowBuilderTarget}
        onRequestClose={stackOrder[12].close}
        style={layerStyle(12)}
        contentStyle={cardStyle}
      >
        {() => (
          <FlowBuilderScreen
            projectId={projectId}
            session={apiSession}
            initialFlowId={flowToOpen}
            onBack={stackOrder[12].close}
          />
        )}
      </StackScreen>

      <StackScreen
        item={templatesTarget}
        onRequestClose={stackOrder[13].close}
        style={layerStyle(13)}
        contentStyle={cardStyle}
      >
        {() => (
          <TemplatesScreen
            key={templatesKey}
            projectId={projectId}
            session={apiSession}
            onBack={() => setTemplatesTarget(false)}
            onCreate={() => setTemplateEditorTarget({})}
            onEdit={template => setTemplateEditorTarget(template)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={templateEditorTarget}
        onRequestClose={stackOrder[14].close}
        style={layerStyle(14)}
        contentStyle={cardStyle}
      >
        {target => (
          <TemplateEditorScreen
            projectId={projectId}
            session={apiSession}
            template={target.template_id || target.id ? target : undefined}
            onBack={() => setTemplateEditorTarget(null)}
            onSaved={() => {
              setTemplateEditorTarget(null);
              setTemplatesKey(k => k + 1);
              // The editor is only reached from Templates, but make sure the
              // list is there to return to.
              setTemplatesTarget(true);
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={contactsTarget}
        onRequestClose={stackOrder[15].close}
        style={layerStyle(15)}
        contentStyle={cardStyle}
      >
        {() => (
          <ContactsScreen
            key={groupListsKey}
            projectId={projectId}
            session={apiSession}
            onBack={() => setContactsTarget(false)}
            onOpenChat={(contactNumber, contactName) => {
              setChatTarget({ number: contactNumber, name: contactName });
              closeAfterCover(() => setContactsTarget(false));
            }}
            onOpenGroupDetails={group => {
              setGroupDetailsPrevious('contacts');
              setGroupDetailsTarget(group);
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={groupsTarget}
        onRequestClose={stackOrder[16].close}
        style={layerStyle(16)}
        contentStyle={cardStyle}
      >
        {() => (
          <GroupsScreen
            key={groupListsKey}
            projectId={projectId}
            session={apiSession}
            onBack={() => setGroupsTarget(false)}
            onOpen={group => {
              setGroupDetailsPrevious('groups');
              setGroupDetailsTarget(group);
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={groupDetailsTarget}
        onRequestClose={stackOrder[17].close}
        style={layerStyle(17)}
        contentStyle={cardStyle}
      >
        {group => (
          <GroupDetailsScreen
            projectId={projectId}
            session={apiSession}
            group={group}
            onBack={() => {
              stackOrder[17].close();
              // Return to whichever list opened the details.
              if (groupDetailsPrevious === 'contacts') {
                setContactsTarget(true);
              } else {
                setGroupsTarget(true);
              }
            }}
            onOpenChat={(contactNumber, contactName) => {
              setChatTarget({ number: contactNumber, name: contactName });
              closeAfterCover(() => setGroupDetailsTarget(null));
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={casesTarget}
        onRequestClose={stackOrder[18].close}
        style={layerStyle(18)}
        contentStyle={cardStyle}
      >
        {() => (
          <OpenCasesScreen
            projectId={projectId}
            session={apiSession}
            onOpenDetails={contact => setCaseDetailsTarget(contact)}
            onCreateCase={contact => setCreateCaseTarget(contact || true)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={caseDetailsTarget}
        onRequestClose={stackOrder[19].close}
        style={layerStyle(19)}
        contentStyle={cardStyle}
      >
        {target => (
          <CaseDetailsScreen
            key={`${projectId}:${target.number}:${target.caseName || ''}`}
            projectId={projectId}
            session={apiSession}
            contactNumber={target.number}
            contactName={target.name}
            initialCaseName={target.caseName}
            onBack={() => setCaseDetailsTarget(null)}
            onOpenChat={(contactNumber, contactName) => {
              setChatTarget({ number: contactNumber, name: contactName });
              closeAfterCover(() => setCaseDetailsTarget(null));
            }}
            onEditCase={caseItem => {
              setEditCaseTarget({ caseItem, returnToDetails: true });
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={createCaseTarget}
        onRequestClose={stackOrder[20].close}
        style={layerStyle(20)}
        contentStyle={cardStyle}
      >
        {target => (
          <CreateCaseScreen
            projectId={projectId}
            session={apiSession}
            initialContact={typeof target === 'object' ? target : null}
            onBack={() => setCreateCaseTarget(null)}
            onCreated={() => {
              setCreateCaseTarget(null);
              setPage('cases');
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={editCaseTarget}
        onRequestClose={stackOrder[21].close}
        style={layerStyle(21)}
        contentStyle={cardStyle}
      >
        {target => (
          <EditCaseScreen
            projectId={projectId}
            session={apiSession}
            caseItem={target.caseItem}
            onBack={() => setEditCaseTarget(null)}
            onSaved={() => setEditCaseTarget(null)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={campaignTarget}
        onRequestClose={stackOrder[22].close}
        style={layerStyle(22)}
        contentStyle={cardStyle}
      >
        {target => (
          <CampaignDetailsScreen
            projectId={projectId}
            session={apiSession}
            campaignId={target.id}
            campaignName={target.name}
            onBack={() => setCampaignTarget(null)}
          />
        )}
      </StackScreen>

      <StackScreen
        item={createCampaignTarget}
        onRequestClose={stackOrder[23].close}
        style={layerStyle(23)}
        contentStyle={cardStyle}
      >
        {() => (
          <CreateCampaignScreen
            projectId={projectId}
            session={apiSession}
            onBack={() => setCreateCampaignTarget(false)}
            onCreated={() => {
              setCreateCampaignTarget(false);
              setPage('campaigns');
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={newChatTarget}
        onRequestClose={stackOrder[24].close}
        style={layerStyle(24)}
        contentStyle={cardStyle}
      >
        {() => (
          <NewChatScreen
            onBack={() => setNewChatTarget(false)}
            onStartChat={(number, name) => {
              setChatTarget({ number, name });
              closeAfterCover(() => setNewChatTarget(false));
            }}
          />
        )}
      </StackScreen>

      <StackScreen
        item={chatTarget}
        onRequestClose={stackOrder[25].close}
        style={[layerStyle(25), { top: -insets.top }]}
        contentStyle={{ backgroundColor: theme.header }}
      >
        {target => (
          <ChatRoomScreen
            key={`${projectId}:${target.number}`}
            projectId={projectId}
            session={apiSession}
            contactNumber={target.number}
            contactName={target.name}
            onBack={() => setChatTarget(null)}
          />
        )}
      </StackScreen>
    </>
  );

  const tabs = hasProject ? FULL_TABS : LIMITED_TABS;

  // Keep the workspace header on Home only. Other tab screens provide
  // their own headers or need the space for their content.
  const showOuterHeader = page === 'dashboard';
  const isKeyboardScreenVisible =
    isKeyboardVisible &&
    (page === 'inbox' || page === 'cases' || page === 'campaigns');

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {showOuterHeader && !isKeyboardScreenVisible && (
        <View
          style={[
            styles.header,
            { backgroundColor: theme.canvas, borderBottomColor: theme.border },
          ]}
        >
          {hasProject ? (
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel="Choose another project"
              onPress={() => setProjectsTarget(true)}
              style={styles.headerTitleGroup}
              activeScale={0.98}
            >
              {projectProfileImage ? (
                <ProjectAvatar
                  name={projectName || 'P'}
                  image={projectProfileImage}
                  size={40}
                  borderRadius={12}
                />
              ) : (
                <View
                  style={[
                    styles.workspaceAvatar,
                    { backgroundColor: theme.isDark ? theme.surface : theme.primary, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.workspaceAvatarText,
                      { color: theme.isDark ? theme.accent : '#FFFFFF' },
                    ]}
                  >
                    {getInitials(projectName || 'P')}
                  </Text>
                </View>
              )}
              <View style={styles.workspaceText}>
                <Text style={[styles.workspaceCaption, { color: theme.muted }]}>
                  Workspace
                </Text>
                <View style={styles.workspaceNameRow}>
                  <Text
                    style={[styles.workspaceName, { color: theme.ink }]}
                    numberOfLines={1}
                  >
                    {projectName || 'Select project'}
                  </Text>
                  <ChevronDown size={16} color={theme.muted} strokeWidth={2.4} />
                </View>
              </View>
            </ScalePressable>
          ) : (
            <View style={styles.headerTitleGroup}>
              <View style={styles.workspaceText}>
                <BrandMark size={36} />
                <Text style={[styles.greeting, { color: theme.muted }]}>
                  Set up your first workspace
                </Text>
              </View>
            </View>
          )}

          <View style={styles.headerActions}>
            {hasProject && (
              <>
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Wallet"
                  onPress={() => setWalletTarget(true)}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  hitSlop={4}
                >
                  <Wallet size={19} color={theme.ink} strokeWidth={2.2} />
                </ScalePressable>
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                  onPress={() => setProfileTarget(true)}
                  style={[styles.profileAvatar, { backgroundColor: theme.mint }]}
                  hitSlop={4}
                >
                  <Text style={[styles.profileAvatarText, { color: theme.mintText }]}>
                    {getInitials(session.profile?.name || session.username || 'U').charAt(0)}
                  </Text>
                </ScalePressable>
                <View ref={menuButtonRef} collapsable={false}>
                  <ScalePressable
                    accessibilityRole="button"
                    accessibilityLabel="More options"
                    onPress={() => {
                      menuButtonRef.current?.measureInWindow((_x, y, _width, height) => {
                        setMenuAnchor({
                          top: y + height,
                        });
                        setIsMenuVisible(true);
                      });
                    }}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                    hitSlop={4}
                  >
                    <MoreVertical size={19} color={theme.ink} strokeWidth={2.2} />
                  </ScalePressable>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      <View style={styles.body}>
        <FadeInView
          key={`${hasProject ? page : `limited-${page}`}-${tabRefreshKey}`}
          duration={180}
          distance={6}
          style={{ flex: 1 }}
        >
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
                onBalanceUpdated={bal => setWalletBalance(bal)}
              />
            ) : page === 'projects' ? (
              <ProjectsScreen
                session={apiSession}
                projects={projects}
                onSelect={onSelectProject}
                onProjectCreated={async proj => {
                  await onProjectCreated(proj);
                  await onSelectProject(proj.id);
                }}
                onRechargeWallet={() => setPage('wallet')}
                onClose={() => setPage('dashboard')}
              />
            ) : (
              <ScrollView
                contentContainerStyle={styles.noProjectPage}
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: theme.mint, borderColor: theme.border },
                  ]}
                >
                  <Briefcase size={30} color={theme.emerald} strokeWidth={2} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.ink }]}>
                  Welcome to OneChatting
                </Text>
                <Text style={[styles.emptyCopy, { color: theme.muted }]}>
                  You don't have a workspace yet. Create one to start chatting
                  with your customers on WhatsApp.
                </Text>
                <ScalePressable
                  accessibilityRole="button"
                  onPress={() => setPage('projects')}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    Create a project
                  </Text>
                </ScalePressable>
                <ScalePressable
                  onPress={() => setPage('wallet')}
                  style={[
                    styles.secondaryLink,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  hitSlop={8}
                >
                  <Wallet size={18} color={theme.emerald} strokeWidth={2.2} />
                  <Text
                    style={[styles.secondaryLinkText, { color: theme.ink }]}
                  >
                    Add funds to wallet
                  </Text>
                </ScalePressable>
                <ScalePressable
                  accessibilityRole="button"
                  onPress={onSignOut}
                  style={[
                    styles.logoutButton,
                    {
                      backgroundColor: theme.dangerBg,
                      borderColor: theme.dangerBorder,
                    },
                  ]}
                >
                  <Text style={[styles.logoutButtonText, { color: theme.danger }]}>
                    Log Out
                  </Text>
                </ScalePressable>
              </ScrollView>
            )
          ) : // ---- Full mode: normal workspace experience ----
          page === 'dashboard' ? (
            <DashboardScreen
              session={apiSession}
              projectId={projectId}
              balance={walletBalance ?? session.balance ?? 0}
              projectCount={
                projectCount ||
                session.projects?.length ||
                session.projectCount ||
                0
              }
              onBalanceUpdated={bal => setWalletBalance(bal)}
              onOpenInbox={() => {
                setInboxFilter(undefined);
                setPage('inbox');
              }}
              onOpenUnread={() => {
                setInboxFilter('unread');
                setPage('inbox');
              }}
              onOpenContacts={() => setContactsTarget(true)}
              onOpenCampaigns={() => setPage('campaigns')}
              onOpenTemplates={() => setTemplatesTarget(true)}
              onOpenProjectsHub={() => setProjectsTarget(true)}
              onOpenWallet={() => setWalletTarget(true)}
              onOpenScannedUsers={() => setScannedUsersTarget(true)}
            />
          ) : page === 'inbox' ? (
            <LiveChatScreen
              projectId={projectId}
              session={apiSession}
              initialFilter={inboxFilter}
              onOpenChat={(contactNumber, contactName) =>
                setChatTarget({ number: contactNumber, name: contactName })
              }
              onNewChat={() => setNewChatTarget(true)}
            />
          ) : page === 'cases' ? (
            <OpenCasesScreen
              projectId={projectId}
              session={apiSession}
              onOpenDetails={(contact) => {
                setCaseDetailsTarget(contact);
              }}
              onCreateCase={(contact) => setCreateCaseTarget(contact || true)}
            />
          ) : page === 'campaigns' ? (
            <CampaignsScreen
              projectId={projectId}
              session={apiSession}
              onOpenCampaign={(campaignId, name) =>
                setCampaignTarget({ id: campaignId, name })
              }
              onCreateCampaign={() => setCreateCampaignTarget(true)}
            />
          ) : null}
        </FadeInView>
      </View>

      {!isKeyboardScreenVisible && <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
          },
        ]}
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = page === tab.key;
          const showBadge = tab.key === 'inbox' && totalUnreadCount > 0;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={
                showBadge
                  ? `${tab.label}, ${totalUnreadCount} unread`
                  : tab.label
              }
              onPress={() => {
                if (tab.key === 'inbox') setInboxFilter(undefined);
                setPage(tab.key);
              }}
              android_ripple={null}
              style={styles.tabItem}
            >
              <View
                style={styles.tabInner}
              >
                <View
                  style={[
                    styles.tabPill,
                    active && { backgroundColor: theme.mint },
                  ]}
                >
                  <Icon
                    size={21}
                    color={active ? theme.emerald : theme.muted}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {showBadge && (
                    <View
                      style={[
                        styles.tabBadge,
                        {
                          backgroundColor: theme.badge,
                          borderColor: theme.surface,
                        },
                      ]}
                    >
                      <Text style={styles.tabBadgeText}>
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? theme.ink : theme.muted },
                    active && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>}

      {hasProject && (
        <Modal
          visible={isMenuVisible}
          transparent
          statusBarTranslucent
          animationType="none"
          onRequestClose={() => setIsMenuVisible(false)}
        >
          <Pressable
            style={styles.menuOverlay}
            onPress={() => setIsMenuVisible(false)}
          >
            <Animated.View
              style={[
                styles.menuContent,
                {
                  top: menuAnchor.top,
                  right: 5,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: menuOpacity,
                  transform: [
                    {
                      translateY: menuOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-15, 0],
                      }),
                    },
                    {
                      scale: menuOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setProjectQrModalOpen(true);
                }}
              >
                <QrCode size={18} color={theme.emerald} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Project QR Code
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setContactsTarget(true);
                }}
              >
                <Users size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  All Contacts
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setGroupsTarget(true);
                }}
              >
                <Users size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Contact Groups
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setTemplatesTarget(true);
                }}
              >
                <FileText size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Templates
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setProjectsTarget(true);
                }}
              >
                <Briefcase size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Projects
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setSupportTarget(true);
                }}
              >
                <HelpCircle size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Support
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setProjectConfigTarget(true);
                }}
              >
                <Settings size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Configuration
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setTransactionsTarget(true);
                }}
              >
                <ReceiptText size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Transactions
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setContextConfigTarget(true);
                }}
              >
                <Brain size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  AI Context
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setAiBillsTarget(true);
                }}
              >
                <ReceiptText size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  AI Bills
                </Text>
              </ScalePressable>
              <ScalePressable
                style={[styles.menuItem]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setProfileTarget(true);
                }}
              >
                <User size={18} color={theme.ink} />
                <Text style={[styles.menuItemText, { color: theme.ink }]}>
                  Profile
                </Text>
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
          projectName={projectName || 'Current Project'}
          projectImage={projectProfileImage}
        />
      )}

      {stackLayers}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 25, fontWeight: '900' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workspaceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceAvatarText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  workspaceText: { flex: 1, minWidth: 0, justifyContent: 'center' },
  workspaceCaption: { fontSize: 12, fontWeight: '500' },
  workspaceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  workspaceName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  profileAvatarText: { fontSize: 15, fontWeight: '800' },
  greeting: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  headerName: { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    alignItems: 'stretch',
    borderTopWidth: 1,
    zIndex: 5,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 9,
    paddingBottom: 9,
    minHeight: 64,
    // Android does not deliver presses to fully transparent empty space.
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  tabLabelActive: { fontWeight: '700' },

  noProjectPage: {
    flexGrow: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 22,
    textAlign: 'center',
  },
  emptyCopy: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  primaryButton: {
    height: 54,
    marginTop: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  secondaryLink: {
    marginTop: 12,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryLinkText: { fontSize: 15, fontWeight: '700' },

  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuContent: {
    position: 'absolute',
    width: 200,
    borderRadius: radii.md,
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
  menuItemText: { fontSize: 15, fontWeight: '600' },
  logoutButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    borderWidth: 1,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
