import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Contacts from 'react-native-contacts';
import Toast from '../ui/toast';
import { SearchClearButton } from '../components/SearchClearButton';
import { Search, MessageSquarePlus, X, Smartphone, User, Phone, Check, BookUser, Users, Image as ImageIcon, Video, FileText, Music, Mic, MapPin, Briefcase } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getCaseList, getInbox, getUnreadCount, ListItem, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { ScreenSkeleton } from '../components/Skeleton';
import { ThemeColors, useTheme, radii, space } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import { ScalePressable, FadeInView } from '../components/animations';
import { useKeyboardContext } from '../contexts/KeyboardContext';

export type ChatFilterType = 'all' | 'unread' | 'favourites' | 'assigned';

const FILTERS: { key: ChatFilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'assigned', label: 'Assigned' },
];

const CHAT_PAGE_SIZE = 30;

type TabState = {
  items: ListItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
};

function blankTab(loading = false): TabState {
  return { items: [], page: 0, hasMore: true, loading, loadingMore: false, error: '' };
}

function blankTabs(loading = false): Record<ChatFilterType, TabState> {
  return {
    all: blankTab(loading),
    unread: blankTab(loading),
    favourites: blankTab(loading),
    assigned: blankTab(loading),
  };
}

type ChatMemory = {
  projectId: string;
  search: string;
  filter: ChatFilterType;
  tabs: Record<ChatFilterType, TabState>;
  offsets: Record<ChatFilterType, number>;
};

let chatMemory: ChatMemory | null = null;

function chatKey(item: ListItem) {
  const contact = (item.contact as Record<string, any>) || {};
  return String(item.id || item._id || contact.number || item.phone || item.number || '');
}

function chatNumber(item: ListItem) {
  const contact = (item.contact as Record<string, any>) || {};
  return String(contact.number || item.phone || item.number || '');
}

/** "Sourav Agarwal" -> "Sourav A." for the compact assignee chip. */
function shortPersonName(value: unknown) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return words[0];
  return `${words[0]} ${words[words.length - 1].charAt(0).toUpperCase()}.`;
}

/** Assignee name if a (future) chat-list row carries it; the current server does not. */
function rowAssigneeName(item: ListItem) {
  const raw: any = (item as any).assigned_user || (item as any).assigned_to || (item as any).assignee;
  if (raw && typeof raw === 'object') return String(raw.name || raw.username || '');
  return typeof raw === 'string' ? raw : String((item as any).assigned_name || '');
}

// Rows that already faded in once; later updates/re-mounts never re-animate them.
const seenRows = new Set<string>();

type RowMeta = {
  /** Numbers assigned to the current user (from chat-list filter=assigned). */
  mine: Record<string, true>;
  /** Number -> latest open case name (from case-list status=open). */
  caseNames: Record<string, string>;
};

const EMPTY_META: RowMeta = { mine: {}, caseNames: {} };
let rowMetaMemory: { projectId: string; meta: RowMeta } | null = null;

function mergeChats(current: ListItem[], incoming: ListItem[]) {
  const seen = new Set(current.map(chatKey));
  const extra = incoming.filter(item => !seen.has(chatKey(item)));
  return extra.length ? [...current, ...extra] : current;
}

export function LiveChatScreen({
  projectId,
  session,
  onOpenChat,
  onNewChat,
  initialFilter,
}: {
  projectId: string;
  session: ApiSession;
  onOpenChat: (contactNumber: string, contactName: string) => void;
  onNewChat?: () => void;
  initialFilter?: ChatFilterType;
}) {
  const theme = useTheme();
  const { keyboardHeightAnim } = useKeyboardContext();
  const [activeFilter, setActiveFilter] = useState<ChatFilterType>(() =>
    initialFilter ?? (chatMemory?.projectId === projectId ? chatMemory.filter : 'all'),
  );
  const filterIndexRef = useRef(FILTERS.findIndex(tab => tab.key === activeFilter));
  const pageWidth = useRef(0);
  const pagerRef = useRef<ScrollView>(null);
  const pagerReady = useRef(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const onPagerScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false }),
  ).current;
  const [pagerSize, setPagerSize] = useState({ width: 0, height: 0 });
  const [tabTrackWidth, setTabTrackWidth] = useState(0);
  const selectTab = (index: number) => {
    const next = Math.max(0, Math.min(FILTERS.length - 1, index));
    filterIndexRef.current = next;
    setActiveFilter(FILTERS[next].key);
    const width = pageWidth.current;
    if (width > 0) pagerRef.current?.scrollTo({ x: next * width, animated: true });
  };
  const settleFromOffset = (x: number) => {
    const width = pageWidth.current;
    if (width <= 0) return;
    const next = Math.max(0, Math.min(FILTERS.length - 1, Math.round(x / width)));
    if (filterIndexRef.current === next) return;
    filterIndexRef.current = next;
    setActiveFilter(FILTERS[next].key);
  };
  const remembered =
    chatMemory && chatMemory.projectId === projectId ? chatMemory : null;
  const [tabs, setTabs] = useState<Record<ChatFilterType, TabState>>(() => {
    if (!remembered) return blankTabs(true);
    return {
      all: { ...remembered.tabs.all, loading: false, loadingMore: false },
      unread: { ...remembered.tabs.unread, loading: false, loadingMore: false },
      favourites: { ...remembered.tabs.favourites, loading: false, loadingMore: false },
      assigned: { ...remembered.tabs.assigned, loading: false, loadingMore: false },
    };
  });
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const offsets = useRef<Record<ChatFilterType, number>>(
    remembered?.offsets || { all: 0, unread: 0, favourites: 0, assigned: 0 },
  );
  const initialOffsets = useRef<Record<ChatFilterType, number>>(
    remembered?.offsets || { all: 0, unread: 0, favourites: 0, assigned: 0 },
  );
  const tabToken = useRef<Record<ChatFilterType, number>>({
    all: 0,
    unread: 0,
    favourites: 0,
    assigned: 0,
  });
  const paging = useRef<Record<ChatFilterType, boolean>>({
    all: false,
    unread: false,
    favourites: false,
    assigned: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState(() =>
    chatMemory?.projectId === projectId ? chatMemory.search : '',
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() =>
    chatMemory?.projectId === projectId ? chatMemory.search : '',
  );
  const searchRef = useRef(debouncedSearchQuery);
  searchRef.current = debouncedSearchQuery;
  const fetchPageRef = useRef<(filter: ChatFilterType, pageToLoad: number, search: string) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount(session, projectId);
      const count =
        res?.data?.count ??
        res?.count ??
        res?.data?.unread_count ??
        res?.unread_count ??
        0;
      setTotalUnreadCount(Number(count) || 0);
    } catch {
      // ignore
    }
  }, [projectId, session.token, session.username]);

  const fetchPage = useCallback(
    async (filter: ChatFilterType, pageToLoad: number, search: string) => {
      if (!projectId || !session?.token) return;
      const current = tabsRef.current[filter];
      if (pageToLoad > 1) {
        if (paging.current[filter] || current.loading || !current.hasMore || current.page < 1) return;
        paging.current[filter] = true;
      }
      const token = pageToLoad === 1 ? ++tabToken.current[filter] : tabToken.current[filter];
      setTabs(prev => ({
        ...prev,
        [filter]: {
          ...prev[filter],
          loading: pageToLoad === 1 && prev[filter].items.length === 0,
          loadingMore: pageToLoad > 1,
          error: '',
        },
      }));
      try {
        const res = await getInbox(session, projectId, search, filter, pageToLoad, CHAT_PAGE_SIZE);
        if (tabToken.current[filter] !== token) return;
        const list = unwrapList(res);
        const meta = res?.meta || res?.data?.meta;
        const total = meta?.total !== undefined ? Number(meta.total) : undefined;
        const hasMore = total !== undefined ? pageToLoad * CHAT_PAGE_SIZE < total : list.length === CHAT_PAGE_SIZE;
        setTabs(prev => ({
          ...prev,
          [filter]: {
            items: pageToLoad === 1 ? list : mergeChats(prev[filter].items, list),
            page: pageToLoad,
            hasMore,
            loading: false,
            loadingMore: false,
            error: '',
          },
        }));
      } catch (requestError) {
        if (tabToken.current[filter] !== token) return;
        setTabs(prev => ({
          ...prev,
          [filter]: {
            ...prev[filter],
            // Keep whatever is on screen; LoadState only shows the error when the list is empty.
            items: prev[filter].items,
            loading: false,
            loadingMore: false,
            error: requestError instanceof Error ? requestError.message : 'Could not load chats.',
          },
        }));
      } finally {
        if (pageToLoad > 1) paging.current[filter] = false;
      }
    },
    [projectId, session],
  );
  fetchPageRef.current = fetchPage;

  const viewabilityConfig = useRef(
    FILTERS.reduce((map, tab) => {
      map[tab.key] = { itemVisiblePercentThreshold: 20 };
      return map;
    }, {} as Record<ChatFilterType, { itemVisiblePercentThreshold: number }>),
  ).current;
  const onViewableItemsChanged = useRef(
    FILTERS.reduce((map, tab) => {
      map[tab.key] = ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
        if (FILTERS[filterIndexRef.current]?.key !== tab.key) return;
        const state = tabsRef.current[tab.key];
        if (!state?.items.length || state.page < 1 || !state.hasMore) return;
        const maxIndex = viewableItems.reduce((max, item) => Math.max(max, item.index ?? 0), 0);
        if (maxIndex < state.items.length - 8) return;
        void fetchPageRef.current(tab.key, state.page + 1, searchRef.current);
      };
      return map;
    }, {} as Record<ChatFilterType, (info: { viewableItems: Array<{ index: number | null }> }) => void>),
  ).current;

  useEffect(() => {
    const sameSearch = chatMemory?.projectId === projectId && chatMemory.search === debouncedSearchQuery;
    if (!sameSearch) {
      // Keep the current rows on screen while the new search loads (no skeleton flash);
      // page 0 blocks paging until the fresh page 1 replaces them.
      setTabs(prev => {
        const next = { ...prev };
        FILTERS.forEach(tab => {
          next[tab.key] = { ...prev[tab.key], page: 0, hasMore: true, error: '', loading: prev[tab.key].items.length === 0 };
        });
        return next;
      });
    }
    FILTERS.forEach(tab => {
      const cached = sameSearch ? chatMemory?.tabs[tab.key] : undefined;
      if (cached && cached.items.length > 0) return;
      void fetchPage(tab.key, 1, debouncedSearchQuery);
    });
    loadUnreadCount();
  }, [fetchPage, loadUnreadCount, debouncedSearchQuery, projectId]);

  useEffect(() => {
    chatMemory = {
      projectId,
      search: debouncedSearchQuery,
      filter: activeFilter,
      tabs,
      offsets: { ...offsets.current },
    };
  }, [tabs, projectId, debouncedSearchQuery, activeFilter]);

  // ── Row meta (assignee + open case chips) ─────────────────────────────
  // chat-list rows carry case_open_count but no assignee/case name, so two batched
  // calls fill the gaps: chat-list?filter=assigned (chats assigned to me) and
  // case-list?status=open (latest open case name per number). Never per-row.
  const [rowMeta, setRowMeta] = useState<RowMeta>(() =>
    rowMetaMemory?.projectId === projectId ? rowMetaMemory.meta : EMPTY_META,
  );
  const loadRowMeta = useCallback(async () => {
    if (!projectId || !session?.token) return;
    const [assignedRes, casesRes] = await Promise.allSettled([
      getInbox(session, projectId, '', 'assigned', 1, 200),
      getCaseList(session, projectId, { status: 'open', limit: 100 }),
    ]);
    setRowMeta(prev => {
      const mine: Record<string, true> = {};
      if (assignedRes.status === 'fulfilled') {
        unwrapList(assignedRes.value).forEach(item => {
          const number = chatNumber(item);
          if (number) mine[number] = true;
        });
      }
      const caseNames: Record<string, string> = {};
      if (casesRes.status === 'fulfilled') {
        unwrapList(casesRes.value).forEach((row: any) => {
          const number = String(row?.number || '');
          const name = String(row?.name || '').trim();
          // case-list is ordered newest first: keep the latest open case per number.
          if (number && name && !caseNames[number]) caseNames[number] = name;
        });
      }
      const next: RowMeta = {
        mine: assignedRes.status === 'fulfilled' ? mine : prev.mine,
        caseNames: casesRes.status === 'fulfilled' ? caseNames : prev.caseNames,
      };
      const same =
        JSON.stringify(next.mine) === JSON.stringify(prev.mine) &&
        JSON.stringify(next.caseNames) === JSON.stringify(prev.caseNames);
      if (same) return prev;
      rowMetaMemory = { projectId, meta: next };
      return next;
    });
  }, [projectId, session]);
  const loadRowMetaRef = useRef(loadRowMeta);
  loadRowMetaRef.current = loadRowMeta;
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRowMeta = useCallback(() => {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => {
      metaTimer.current = null;
      void loadRowMetaRef.current();
    }, 400);
  }, []);
  useEffect(() => {
    if (rowMetaMemory?.projectId !== projectId) setRowMeta(EMPTY_META);
    void loadRowMeta();
    return () => {
      if (metaTimer.current) clearTimeout(metaTimer.current);
    };
  }, [loadRowMeta, projectId]);

  // Stable callbacks for the memoized pages/rows.
  const onOpenChatRef = useRef(onOpenChat);
  onOpenChatRef.current = onOpenChat;
  const openChat = useCallback((contactNumber: string, contactName: string) => {
    onOpenChatRef.current(contactNumber, contactName);
  }, []);

  const requestNext = useCallback((filter: ChatFilterType) => {
    const tab = tabsRef.current[filter];
    if (!tab || tab.loading || tab.loadingMore || !tab.hasMore || tab.page < 1) return;
    void fetchPage(filter, tab.page + 1, debouncedSearchQuery);
  }, [debouncedSearchQuery, fetchPage]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        ...FILTERS.map(tab => fetchPage(tab.key, 1, debouncedSearchQuery)),
        loadRowMeta(),
      ]);
      await loadUnreadCount();
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage, debouncedSearchQuery, loadUnreadCount, loadRowMeta]);

  useEffect(() => {
    const unsubUnread = socketManager.onTotalUnreadCount((data) => {
      if (typeof data?.count === 'number') {
        setTotalUnreadCount(data.count);
      }
    });

    const unsubChat = socketManager.onChat((data) => {
      const contactNum = data.contact?.number;
      if (!contactNum) return;
      const incoming = data.message?.type === 'in' && data.message?.status !== 'read';
      setTabs(prev => {
        const next = { ...prev };
        FILTERS.forEach(tab => {
          const items = prev[tab.key].items;
          const existingIdx = items.findIndex(c => {
            const cNum = (c.contact as Record<string, any>)?.number || c.phone || c.number;
            return String(cNum) === String(contactNum);
          });
          if (existingIdx < 0 && tab.key !== 'all' && !(tab.key === 'unread' && incoming)) return;
          const newChat: any = existingIdx >= 0
            ? { ...items[existingIdx] }
            : { contact: data.contact, number: contactNum, unread_count: 0 };
          newChat.last_message = data.message;
          if (incoming) newChat.unread_count = Number(newChat.unread_count || 0) + 1;
          const list = [...items];
          if (existingIdx >= 0) list.splice(existingIdx, 1);
          list.unshift(newChat);
          next[tab.key] = { ...prev[tab.key], items: list };
        });
        return next;
      });
      loadUnreadCount();
    });

    const unsubAssigned = socketManager.onChatAssigned(() => {
      // Payload has no contact number, so re-read the (batched) assignment set.
      void fetchPage('assigned', 1, debouncedSearchQuery);
      scheduleRowMeta();
    });

    const unsubCase = socketManager.onCaseStatus((data) => {
      const number = data?.number != null ? String(data.number) : '';
      const count = Number(data?.case_open_count);
      if (number && Number.isFinite(count)) {
        setTabs(prev => {
          let changed = false;
          const next = { ...prev };
          FILTERS.forEach(tab => {
            const items = prev[tab.key].items;
            const idx = items.findIndex(c => chatNumber(c) === number);
            if (idx < 0 || Number(items[idx].case_open_count || 0) === count) return;
            const list = [...items];
            list[idx] = { ...items[idx], case_open_count: count };
            next[tab.key] = { ...prev[tab.key], items: list };
            changed = true;
          });
          return changed ? next : prev;
        });
      }
      scheduleRowMeta();
    });

    const unsubStatus = socketManager.onMessageStatus((data) => {
      if (!data?.wamid) return;
      setTabs(prev => {
        let changed = false;
        const next = { ...prev };
        FILTERS.forEach(tab => {
          let tabChanged = false;
          const items = prev[tab.key].items.map(c => {
            const lastMsg = (c.last_message as Record<string, any>) || {};
            if ((lastMsg.wamid === data.wamid || lastMsg._id === data.message_id) && lastMsg.status !== data.status) {
              tabChanged = true;
              return { ...c, last_message: { ...lastMsg, status: data.status } };
            }
            return c;
          });
          if (tabChanged) {
            changed = true;
            next[tab.key] = { ...prev[tab.key], items };
          }
        });
        return changed ? next : prev;
      });
    });

    return () => {
      unsubUnread();
      unsubChat();
      unsubAssigned();
      unsubCase();
      unsubStatus();
    };
  }, [debouncedSearchQuery, fetchPage, loadUnreadCount, scheduleRowMeta]);

  return (
    <Animated.View
      style={[
        { flex: 1, backgroundColor: theme.canvas },
        {
          paddingBottom: keyboardHeightAnim,
        },
      ]}
    >
      <FadeInView direction="down" distance={10} duration={300} style={styles.heading}>
        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: theme.ink }]}>Chats</Text>
          {onNewChat ? (
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel="New chat"
              onPress={() => onNewChat?.()}
              style={[styles.iconBtn, { backgroundColor: theme.primary }]}
              hitSlop={4}
            >
              <MessageSquarePlus size={20} color={theme.onPrimary} strokeWidth={2.2} />
            </ScalePressable>
          ) : null}
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.fieldBg }]}>
          <Search size={18} color={theme.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.ink }]}
            placeholder="Search chats by name or number..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          <SearchClearButton value={searchQuery} onClear={() => setSearchQuery('')} color={theme.muted} />
        </View>

        {/* Filter chips */}
        <View
          onLayout={event => {
            const width = event.nativeEvent.layout.width;
            if (width > 0 && Math.abs(width - tabTrackWidth) > 1) setTabTrackWidth(width);
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipsRow}
          >
            {FILTERS.map((tab) => {
              const isActive = activeFilter === tab.key;
              const showCount = tab.key === 'unread' && totalUnreadCount > 0;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => selectTab(FILTERS.findIndex(item => item.key === tab.key))}
                  style={[
                    styles.chip,
                    isActive
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: isActive ? theme.onPrimary : theme.inkSoft },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {showCount && (
                    <View
                      style={[
                        styles.chipCount,
                        { backgroundColor: isActive ? theme.onPrimary : theme.emerald },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipCountText,
                          { color: isActive ? theme.primary : theme.isDark ? theme.onAccent : '#FFFFFF' },
                        ]}
                      >
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </FadeInView>

      <View
        style={styles.pager}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (width <= 0 || height <= 0) return;
          if (Math.abs(width - pageWidth.current) < 1 && Math.abs(height - pagerSize.height) < 1) return;
          pageWidth.current = width;
          setPagerSize({ width, height });
        }}
      >
        {pagerSize.width > 0 ? (
          <Animated.ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            disableIntervalMomentum
            nestedScrollEnabled
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            overScrollMode="never"
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            onScroll={onPagerScroll}
            onLayout={() => {
              if (pagerReady.current) return;
              pagerReady.current = true;
              const width = pageWidth.current;
              const index = filterIndexRef.current;
              if (width > 0 && index > 0) {
                scrollX.setValue(index * width);
                pagerRef.current?.scrollTo({ x: index * width, animated: false });
              }
            }}
            onMomentumScrollEnd={event => settleFromOffset(event.nativeEvent.contentOffset.x)}
            onScrollEndDrag={event => {
              const velocity = event.nativeEvent.velocity?.x ?? 0;
              if (Math.abs(velocity) < 0.05) settleFromOffset(event.nativeEvent.contentOffset.x);
            }}
            style={{ width: pagerSize.width, height: pagerSize.height }}
          >
            {FILTERS.map(tab => {
              const page = tabs[tab.key];
              return (
                <MemoChatTabPage
                  key={tab.key}
                  width={pagerSize.width}
                  height={pagerSize.height}
                  items={page.items}
                  loading={page.loading}
                  error={page.error}
                  refreshing={refreshing}
                  rowMeta={rowMeta}
                  myUsername={session.username}
                  initialOffset={initialOffsets.current[tab.key] || 0}
                  onOpenChat={openChat}
                  onRefresh={load}
                  onRetry={() => {
                    void fetchPage(tab.key, 1, debouncedSearchQuery);
                    loadUnreadCount();
                  }}
                  onLoadMore={() => {
                    if (FILTERS[filterIndexRef.current]?.key !== tab.key) return;
                    requestNext(tab.key);
                  }}
                  onScrollOffset={y => {
                    offsets.current[tab.key] = y;
                    if (chatMemory && chatMemory.projectId === projectId) {
                      chatMemory.offsets[tab.key] = y;
                      chatMemory.filter = tab.key;
                    }
                  }}
                  viewabilityConfig={viewabilityConfig[tab.key]}
                  onViewableItemsChanged={onViewableItemsChanged[tab.key]}
                />
              );
            })}
          </Animated.ScrollView>
        ) : (
          <ScreenSkeleton variant="chat" />
        )}
      </View>

    </Animated.View>
  );
}



function ChatTabPage({
  width,
  height,
  items,
  loading,
  error,
  refreshing,
  rowMeta,
  myUsername,
  initialOffset,
  onOpenChat,
  onRefresh,
  onRetry,
  onLoadMore,
  onScrollOffset,
  viewabilityConfig,
  onViewableItemsChanged,
}: {
  width: number;
  height: number;
  items: ListItem[];
  loading: boolean;
  error: string;
  refreshing: boolean;
  rowMeta: RowMeta;
  myUsername: string;
  initialOffset: number;
  onOpenChat: (contactNumber: string, contactName: string) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onScrollOffset: (y: number) => void;
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  onViewableItemsChanged: (info: { viewableItems: Array<{ index: number | null }> }) => void;
}) {
  const theme = useTheme();
  const startOffset = useRef(initialOffset).current;
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      const number = chatNumber(item);
      const rowAssignee = rowAssigneeName(item);
      const assignedToMe =
        Boolean(number && rowMeta.mine[number]) ||
        Boolean(myUsername && (item as any).assigned_user?.username === myUsername);
      return (
        <ChatCard
          item={item}
          onPress={onOpenChat}
          assigneeLabel={assignedToMe ? 'Assigned to you' : shortPersonName(rowAssignee)}
          caseName={number ? rowMeta.caseNames[number] || '' : ''}
        />
      );
    },
    [onOpenChat, rowMeta, myUsername],
  );

  return (
    <View style={{ width, height }}>
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item, index) => chatKey(item) || `chat-${index}`}
        renderItem={renderItem}
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={40}
        windowSize={10}
        onEndReached={onLoadMore}
        onEndReachedThreshold={1.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentOffset={{ x: 0, y: startOffset }}
        onScroll={event => onScrollOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.emerald} />
        }
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="chat" />
          ) : (
            <LoadState loading={false} error={error} empty={!error} onRetry={onRetry} />
          )
        }
      />
    </View>
  );
}

const MemoChatTabPage = memo(ChatTabPage, (prev, next) =>
  prev.items === next.items &&
  prev.loading === next.loading &&
  prev.error === next.error &&
  prev.refreshing === next.refreshing &&
  prev.rowMeta === next.rowMeta &&
  prev.myUsername === next.myUsername &&
  prev.onOpenChat === next.onOpenChat &&
  prev.width === next.width &&
  prev.height === next.height,
);

function lastMessagePreview(lastMessage: Record<string, any>, item: ListItem) {
  const type = String(lastMessage.message_type || (item as any).message_type || 'text').toLowerCase();
  const text = String(lastMessage.message || (item as any).message || '').trim();
  switch (type) {
    case 'image':
      return { label: 'Photo', Icon: ImageIcon };
    case 'video':
      return { label: 'Video', Icon: Video };
    case 'audio':
      return { label: 'Audio', Icon: Music };
    case 'voice':
      return { label: 'Voice message', Icon: Mic };
    case 'document':
      return { label: 'Document', Icon: FileText };
    case 'location':
      return { label: 'Location', Icon: MapPin };
    case 'contact':
      return { label: 'Contact', Icon: User };
    case 'sticker':
      return { label: 'Sticker', Icon: null };
    default:
      return { label: text || (type !== 'text' ? 'Message' : ''), Icon: null };
  }
}

function parseListDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
    );
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatListTime(value: unknown) {
  const date = parseListDate(value);
  if (!date) return '';
  const startOfDay = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (dayDiff <= 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return date.toLocaleDateString([], { weekday: 'long' });
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function avatarTone(name: string, theme: ThemeColors) {
  const tones = [
    { bg: theme.infoBg, fg: theme.info },
    { bg: theme.mint, fg: theme.mintText },
    { bg: theme.violetBg, fg: theme.violet },
    { bg: theme.warnBg, fg: theme.warning },
    { bg: theme.dangerBg, fg: theme.danger },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return tones[Math.abs(hash) % tones.length];
}

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0].charAt(0);
  const second = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + second).toUpperCase();
}

const ChatCard = memo(function ChatCard({
  item,
  onPress,
  assigneeLabel,
  caseName,
}: {
  item: ListItem;
  onPress: (contactNumber: string, contactName: string) => void;
  assigneeLabel: string;
  caseName: string;
}) {
  const theme = useTheme();
  const rowKey = chatKey(item);
  const opacity = useRef(new Animated.Value(seenRows.has(rowKey) ? 1 : 0)).current;
  useEffect(() => {
    if (seenRows.has(rowKey)) {
      opacity.setValue(1);
      return;
    }
    seenRows.add(rowKey);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity, rowKey]);
  const contact = (item.contact as Record<string, any>) || {};
  const lastMessage = (item.last_message as Record<string, any>) || {};

  const contactNumber = String(contact.number || item.phone || item.number || '');
  const name = String(
    contact.name || contact.number || item.name || item.contact_name || item.phone || 'Untitled',
  );
  const preview = lastMessagePreview(lastMessage, item);
  const time = formatListTime(lastMessage.create_date || lastMessage.createdAt || item.date || item.created_at || '');
  const unreadCount = Number(item.unread_count ?? 0);
  const isUnread = unreadCount > 0;
  const tone = avatarTone(name, theme);
  const showNumber = Boolean(contactNumber) && contactNumber !== name;
  const openCases = Number((item as any).case_open_count ?? 0) || 0;
  const caseLabel =
    openCases > 0
      ? caseName
        ? openCases > 1
          ? `${caseName} +${openCases - 1}`
          : caseName
        : openCases > 1
          ? `${openCases} cases open`
          : 'Case open'
      : '';

  return (
    <Animated.View style={{ opacity }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isUnread ? `${name}, ${unreadCount} unread` : name}
      onPress={() => onPress(contactNumber, name)}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: theme.cardHover }]}
    >
      <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
        <Text style={[styles.avatarText, { color: tone.fg }]}>{initialsOf(name)}</Text>
      </View>

      <View style={[styles.cardBody, { borderBottomColor: theme.divider }]}>
        <View style={styles.cardTopRow}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.ink }]}>
            {name}
          </Text>
          {time ? (
            <Text
              numberOfLines={1}
              style={[
                styles.timeText,
                isUnread ? { color: theme.emerald, fontWeight: '700' } : { color: theme.muted },
              ]}
            >
              {time}
            </Text>
          ) : null}
        </View>

        <View style={styles.previewRow}>
          {(() => {
            const PreviewIcon = preview.Icon;
            return PreviewIcon ? (
              <PreviewIcon size={14} color={isUnread ? theme.inkSoft : theme.muted} />
            ) : null;
          })()}
          <Text
            numberOfLines={1}
            style={[
              styles.cardDetail,
              { color: isUnread ? theme.inkSoft : theme.muted },
              isUnread && { fontWeight: '600' },
            ]}
          >
            {preview.label || ' '}
          </Text>
          {isUnread && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.emerald }]}>
              <Text style={[styles.unreadText, { color: theme.isDark ? theme.onAccent : '#FFFFFF' }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {showNumber ? (
          <Text numberOfLines={1} style={[styles.cardMeta, { color: theme.muted }]}>
            {contactNumber}
          </Text>
        ) : null}

        {assigneeLabel || caseLabel ? (
          <View style={styles.tagRow}>
            {assigneeLabel ? (
              <View style={[styles.tag, { backgroundColor: theme.infoBg }]}>
                <User size={11} color={theme.info} strokeWidth={2.4} />
                <Text numberOfLines={1} style={[styles.tagText, { color: theme.info }]}>
                  {assigneeLabel}
                </Text>
              </View>
            ) : null}
            {caseLabel ? (
              <View style={[styles.tag, styles.tagShrink, { backgroundColor: theme.warnBg }]}>
                <Briefcase size={11} color={theme.warning} strokeWidth={2.4} />
                <Text numberOfLines={1} style={[styles.tagText, { color: theme.warning }]}>
                  {caseLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  heading: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    gap: space.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pager: { flex: 1, overflow: 'hidden' },
  list: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 12,
    paddingRight: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  cardDetail: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    marginLeft: 8,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    maxWidth: '60%',
  },
  tagShrink: { flexShrink: 1 },
  tagText: { fontSize: 11, fontWeight: '700' },
  unreadBadge: {
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Full-screen "New Chat" view
  fullScreen: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  fullScreenBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  deviceContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
    marginBottom: 16,
  },
  deviceContactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceContactBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  deviceContactBtnSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalInput: {
    fontSize: 15,
  },
  modalButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  // Device contacts modal
  deviceModalContainer: {
    flex: 1,
  },
  deviceModalHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 12,
  },
  deviceModalBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  deviceModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  deviceModalSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  deviceSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  deviceSearchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  deviceListContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 8,
  },
  deviceContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  deviceContactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceContactAvatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  deviceContactName: {
    fontSize: 14,
    fontWeight: '800',
  },
  deviceContactNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  deviceChatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  deviceChatBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  deviceEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 8,
  },
  deviceEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  deviceEmptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLoader: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoaderText: { fontSize: 12 },
});