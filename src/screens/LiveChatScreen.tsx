import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Contacts from 'react-native-contacts';
import Toast from 'react-native-toast-message';
import { Search, MessageSquarePlus, X, Smartphone, User, Phone, Check, BookUser, Users } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getInbox, getUnreadCount, ListItem, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import { ScalePressable, FadeInView, PulseView } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';

export type ChatFilterType = 'all' | 'unread' | 'favourites' | 'assigned';

const FILTERS: { key: ChatFilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'assigned', label: 'Assigned' },
];

export function LiveChatScreen({
  projectId,
  session,
  onOpenChat,
  onNewChat,
}: {
  projectId: string;
  session: ApiSession;
  onOpenChat: (contactNumber: string, contactName: string) => void;
  onNewChat?: () => void;
}) {
  const theme = useTheme();
  const [activeFilter, setActiveFilter] = useState<ChatFilterType>('all');
  const [items, setItems] = useState<ListItem[]>([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getInbox(
        session,
        projectId,
        debouncedSearchQuery,
        activeFilter,
      );
      setItems(unwrapList(res));
    } catch (requestError) {
      setItems([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load chats.',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, session.token, session.username, debouncedSearchQuery, activeFilter]);

  useEffect(() => {
    load();
    loadUnreadCount();
  }, [load, loadUnreadCount]);

  useEffect(() => {
    const unsubUnread = socketManager.onTotalUnreadCount((data) => {
      if (typeof data?.count === 'number') {
        setTotalUnreadCount(data.count);
      }
    });

    const unsubChat = socketManager.onChat((data) => {
      setItems((prev) => {
        const contactNum = data.contact?.number;
        if (!contactNum) return prev;

        const existingIdx = prev.findIndex((c) => {
          const cNum = (c.contact as Record<string, any>)?.number || c.phone || c.number;
          return String(cNum) === String(contactNum);
        });

        const newChat: any =
          existingIdx >= 0
            ? { ...prev[existingIdx] }
            : { contact: data.contact, number: contactNum, unread_count: 0 };

        newChat.last_message = data.message;
        if (data.message.type === 'in' && data.message.status !== 'read') {
          newChat.unread_count = Number(newChat.unread_count || 0) + 1;
        }

        const nextList = [...prev];
        if (existingIdx >= 0) {
          nextList.splice(existingIdx, 1);
        }

        nextList.unshift(newChat);
        return nextList;
      });

      // Also refresh unread count
      loadUnreadCount();
    });

    const unsubAssigned = socketManager.onChatAssigned(() => {
      load();
    });

    const unsubStatus = socketManager.onMessageStatus((data) => {
      if (!data?.wamid) return;
      setItems((prev) =>
        prev.map((c) => {
          const lastMsg = (c.last_message as Record<string, any>) || {};
          if (lastMsg.wamid === data.wamid || lastMsg._id === data.message_id) {
            return {
              ...c,
              last_message: { ...lastMsg, status: data.status },
            };
          }
          return c;
        }),
      );
    });

    return () => {
      unsubUnread();
      unsubChat();
      unsubAssigned();
      unsubStatus();
    };
  }, [load, loadUnreadCount]);

  return (
    <KeyboardAvoidView style={{ flex: 1, backgroundColor: theme.canvas }}>
      <FadeInView direction="down" distance={10} duration={300} style={styles.heading}>
        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Search size={18} color={theme.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.ink }]}
            placeholder="Search chats by name or number..."
            placeholderTextColor={theme.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>

        {/* Filtration Tabs */}
        <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
          {FILTERS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                onPress={() => setActiveFilter(tab.key)}
                style={styles.tabButton}
                hitSlop={4}
              >
                <View style={styles.tabInner}>
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isActive ? '#2563EB' : theme.muted },
                      isActive && styles.tabLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {tab.key === 'all' && totalUnreadCount > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: '#10B981' }]}>
                      <Text style={styles.tabBadgeText}>{totalUnreadCount}</Text>
                    </View>
                  )}
                </View>
                {isActive && <View style={[styles.activeIndicator, { backgroundColor: '#2563EB' }]} />}
              </Pressable>
            );
          })}
        </View>
      </FadeInView>

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id || item._id || (item.contact as any)?.number || index) + '-' + index}
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              load();
              loadUnreadCount();
            }}
            tintColor={theme.emerald}
          />
        }
        ListEmptyComponent={
          <LoadState
            loading={false}
            error={error}
            empty={!loading && !error}
            onRetry={() => {
              load();
              loadUnreadCount();
            }}
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index * 35, 250)} distance={12}>
            <ChatCard
              item={item}
              onPress={(contactNumber, contactName) => onOpenChat(contactNumber, contactName)}
            />
          </FadeInView>
        )}
      />

      {/* FAB */}
      <ScalePressable
        accessibilityRole="button"
        onPress={() => onNewChat?.()}
        style={[
          styles.fab,
          { backgroundColor: theme.emerald },
        ]}
      >
        <MessageSquarePlus size={24} color="#FFF" />
      </ScalePressable>
    </KeyboardAvoidView>
  );
}



function ChatCard({ item, onPress }: { item: ListItem; onPress: (contactNumber: string, contactName: string) => void }) {
  const theme = useTheme();
  const contact = (item.contact as Record<string, any>) || {};
  const lastMessage = (item.last_message as Record<string, any>) || {};

  const contactNumber = String(contact.number || item.phone || item.number || '');
  const name = String(
    contact.name || contact.number || item.name || item.contact_name || item.phone || 'Untitled',
  );
  const detail = String(
    lastMessage.message ||
    item.message ||
    item.status ||
    item.phone ||
    item.number ||
    '',
  );
  const rawDate = lastMessage.createdAt || item.date || item.created_at || '';
  const date = rawDate ? new Date(rawDate) : null;
  const time =
    date && !isNaN(date.getTime())
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  const unreadCount = Number(item.unread_count ?? 0);

  return (
    <ScalePressable
      accessibilityRole="button"
      onPress={() => onPress(contactNumber, name)}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
        <Text style={[styles.avatarText, { color: theme.mintText }]}>
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.ink, flex: 1 }]}>
            {name}
          </Text>
          {time ? (
            <Text style={[styles.timeText, { color: theme.muted }]}>
              {time}
            </Text>
          ) : null}
        </View>

        <Text numberOfLines={1} style={[styles.cardDetail, { color: theme.muted }]}>
          {detail}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.cardMeta, { color: theme.muted }]}>
            {contactNumber}
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.emerald }]}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.arrow, { color: theme.muted }]}>›</Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 2,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    paddingTop: 8,
    gap: 10,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 17,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800' },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardDetail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  cardMeta: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    marginLeft: 8,
  },
  unreadBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginTop: 6,
  },
  unreadText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  arrow: { fontSize: 24, lineHeight: 26, marginLeft: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
});