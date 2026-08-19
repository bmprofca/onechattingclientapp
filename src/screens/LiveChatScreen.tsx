import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, MessageSquarePlus, X } from 'lucide-react-native';
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
}: {
  projectId: string;
  session: ApiSession;
  onOpenChat: (contactNumber: string, contactName: string) => void;
}) {
  const theme = useTheme();
  const [activeFilter, setActiveFilter] = useState<ChatFilterType>('all');
  const [items, setItems] = useState<ListItem[]>([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Controls whether the full-screen "New Chat" view is shown instead of the list.
  const [isNewChatVisible, setIsNewChatVisible] = useState(false);

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

  // Full-screen "New Chat" view replaces the whole page while active.
  // This avoids the bottom-sheet-modal problem where the keyboard can cover
  // the input if the sheet's maxHeight is smaller than the keyboard height.
  if (isNewChatVisible) {
    return (
      <NewChatScreen
        theme={theme}
        onClose={() => setIsNewChatVisible(false)}
        onStart={(number, name) => {
          setIsNewChatVisible(false);
          onOpenChat(number, name);
        }}
      />
    );
  }

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
        onPress={() => setIsNewChatVisible(true)}
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

function NewChatScreen({
  theme,
  onClose,
  onStart,
}: {
  theme: ReturnType<typeof useTheme>;
  onClose: () => void;
  onStart: (contactNumber: string, contactName: string) => void;
}) {
  const [newChatNumber, setNewChatNumber] = useState('');
  const [newChatName, setNewChatName] = useState('');

  const handleDirectChat = () => {
    if (!newChatNumber.trim()) return;
    onStart(newChatNumber.trim(), newChatName.trim() || newChatNumber.trim());
  };

  return (
    <KeyboardAvoidingView
      style={[styles.fullScreen, { backgroundColor: theme.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FadeInView direction="up" distance={12} duration={250} style={{ flex: 1 }}>
        <View style={[styles.fullScreenHeader, { borderBottomColor: theme.border }]}>
          <ScalePressable onPress={onClose} hitSlop={8}>
            <X size={24} color={theme.muted} />
          </ScalePressable>
          <Text style={[styles.modalTitle, { color: theme.ink }]}>New Chat</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.fullScreenBody}>
          <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
            Enter a phone number with country code to start a new direct chat.
          </Text>

          <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.modalInput, { color: theme.ink }]}
              placeholder="Phone Number (e.g. 919876543210)"
              placeholderTextColor={theme.muted}
              keyboardType="phone-pad"
              value={newChatNumber}
              onChangeText={setNewChatNumber}
              autoFocus
              returnKeyType="next"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.modalInput, { color: theme.ink }]}
              placeholder="Contact Name (Optional)"
              placeholderTextColor={theme.muted}
              value={newChatName}
              onChangeText={setNewChatName}
              returnKeyType="done"
              onSubmitEditing={handleDirectChat}
            />
          </View>

          <ScalePressable
            style={[styles.modalButton, { backgroundColor: theme.emerald }]}
            onPress={handleDirectChat}
          >
            <Text style={styles.modalButtonText}>Start Conversation</Text>
          </ScalePressable>
        </View>
      </FadeInView>
    </KeyboardAvoidingView>
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
    item.email ||
    'No details available',
  );

  const unreadCount = Number(item.unread_count || 0);

  return (
    <ScalePressable
      accessibilityRole="button"
      onPress={() => onPress(contactNumber, name)}
      style={styles.card}
    >
      <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
        <Text style={[styles.avatarText, { color: theme.mintText }]}>
          {name.trim().charAt(0).toUpperCase() || '1'}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.ink, flex: 1 }]}>
            {name}
          </Text>
          {lastMessage.create_date && (
            <Text style={[styles.timeText, { color: theme.muted }]}>
              {new Date(lastMessage.create_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <Text numberOfLines={1} style={[styles.cardDetail, { color: theme.muted }]}>
          {detail}
        </Text>
        {unreadCount > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.cardMeta, { color: theme.muted }]}>Unread Messages</Text>

            <PulseView duration={1400} maxScale={1.1} minScale={0.94}>
              <View style={[styles.unreadBadge, { backgroundColor: theme.emerald }]}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            </PulseView>
          </View>
        )}
      </View>
      <Text style={[styles.arrow, { color: theme.muted }]}>›</Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: 12, paddingBottom: 0, paddingHorizontal: 12 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 15,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    paddingTop: 4,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    position: 'relative',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
  },
  list: { paddingHorizontal: 10, paddingBottom: 18, paddingTop: 4 },
  emptyList: { flexGrow: 1, paddingHorizontal: 0 },
  card: {
    borderRadius: 17,
    padding: 6,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
  // Full-screen "New Chat" view (replaces the old bottom-sheet modal styles)
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
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
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
});