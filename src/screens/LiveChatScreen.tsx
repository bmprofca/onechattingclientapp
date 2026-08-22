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
  const [deviceContactsModalOpen, setDeviceContactsModalOpen] = useState(false);
  const [deviceContactsList, setDeviceContactsList] = useState<Array<{ id: string; name: string; number: string }>>([]);
  const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);
  const [deviceContactsSearch, setDeviceContactsSearch] = useState('');

  const loadDeviceContacts = useCallback(async () => {
    setLoadingDeviceContacts(true);
    try {
      let hasPermission = false;
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts Permission',
            message: 'OneChat needs access to your device contacts to start direct chats easily.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        hasPermission = true;
      }

      if (!hasPermission) {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Please grant contacts permission to select from device contacts.',
        });
        return;
      }

      const raw = await Contacts.getAllWithoutPhotos();
      const parsed: Array<{ id: string; name: string; number: string }> = [];
      const seen = new Set<string>();

      raw.forEach((c) => {
        const fullName = [c.givenName, c.middleName, c.familyName]
          .filter(Boolean)
          .join(' ')
          .trim() || c.displayName || 'Unnamed Contact';

        if (Array.isArray(c.phoneNumbers)) {
          c.phoneNumbers.forEach((pn) => {
            const rawNum = pn.number || '';
            const cleaned = rawNum.replace(/[^0-9+]/g, '');
            if (cleaned.length >= 7) {
              const key = `${fullName}-${cleaned}`;
              if (!seen.has(key)) {
                seen.add(key);
                parsed.push({
                  id: `${c.recordID || ''}-${pn.label || ''}-${cleaned}`,
                  name: fullName,
                  number: cleaned,
                });
              }
            }
          });
        }
      });

      parsed.sort((a, b) => a.name.localeCompare(b.name));
      setDeviceContactsList(parsed);
      setDeviceContactsModalOpen(true);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load contacts',
        text2: err?.message || 'Failed to read contacts from device.',
      });
    } finally {
      setLoadingDeviceContacts(false);
    }
  }, []);

  const filteredDeviceContacts = useMemo(() => {
    if (!deviceContactsSearch.trim()) return deviceContactsList;
    const q = deviceContactsSearch.toLowerCase().trim();
    return deviceContactsList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q),
    );
  }, [deviceContactsList, deviceContactsSearch]);

  const handleDirectChat = () => {
    if (!newChatNumber.trim()) return;
    onStart(newChatNumber.trim(), newChatName.trim() || newChatNumber.trim());
  };

  const handleSelectDeviceContact = (contact: { name: string; number: string }) => {
    setDeviceContactsModalOpen(false);
    onStart(contact.number, contact.name || contact.number);
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
          {/* Option: Pick from Device Contacts */}
          <ScalePressable
            style={[
              styles.deviceContactBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.emerald,
              },
            ]}
            onPress={loadDeviceContacts}
            disabled={loadingDeviceContacts}
          >
            <View style={[styles.deviceContactIconWrap, { backgroundColor: theme.mint }]}>
              {loadingDeviceContacts ? (
                <ActivityIndicator size="small" color={theme.emerald} />
              ) : (
                <Smartphone size={22} color={theme.emerald} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.deviceContactBtnTitle, { color: theme.ink }]}>
                Choose from Device Contacts
              </Text>
              <Text style={[styles.deviceContactBtnSubtitle, { color: theme.muted }]}>
                Select a contact directly from your phonebook
              </Text>
            </View>
            <Text style={{ color: theme.emerald, fontSize: 20, fontWeight: '700' }}>›</Text>
          </ScalePressable>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.muted, backgroundColor: theme.canvas }]}>
              OR ENTER MANUALLY
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

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

      {/* Device Contacts Selection Modal */}
      <Modal
        visible={deviceContactsModalOpen}
        animationType="slide"
        onRequestClose={() => setDeviceContactsModalOpen(false)}
      >
        <View style={[styles.deviceModalContainer, { backgroundColor: theme.canvas }]}>
          <View style={[styles.deviceModalHeader, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
            <ScalePressable
              onPress={() => setDeviceContactsModalOpen(false)}
              hitSlop={8}
              style={styles.deviceModalBackBtn}
            >
              <X size={22} color={theme.ink} />
            </ScalePressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.deviceModalTitle, { color: theme.ink }]}>
                Device Contacts
              </Text>
              <Text style={[styles.deviceModalSubtitle, { color: theme.muted }]}>
                {deviceContactsList.length} contacts found
              </Text>
            </View>
          </View>

          {/* Search bar */}
          <View style={[styles.deviceSearchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Search size={16} color={theme.muted} />
            <TextInput
              style={[styles.deviceSearchInput, { color: theme.ink }]}
              placeholder="Search by name or number..."
              placeholderTextColor={theme.muted}
              value={deviceContactsSearch}
              onChangeText={setDeviceContactsSearch}
            />
            {deviceContactsSearch.length > 0 && (
              <Pressable onPress={() => setDeviceContactsSearch('')} hitSlop={8}>
                <X size={16} color={theme.muted} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filteredDeviceContacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.deviceListContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.deviceEmptyWrap}>
                <Smartphone size={36} color={theme.muted} />
                <Text style={[styles.deviceEmptyTitle, { color: theme.ink }]}>
                  {deviceContactsSearch ? 'No matching contacts' : 'No contacts found'}
                </Text>
                <Text style={[styles.deviceEmptySubtitle, { color: theme.muted }]}>
                  {deviceContactsSearch
                    ? 'Try searching with a different name or number.'
                    : 'No valid phone numbers found in your device contacts.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <ScalePressable
                style={[
                  styles.deviceContactCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => handleSelectDeviceContact(item)}
              >
                <View style={[styles.deviceContactAvatar, { backgroundColor: theme.mint }]}>
                  <Text style={[styles.deviceContactAvatarText, { color: theme.mintText }]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.deviceContactName, { color: theme.ink }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.deviceContactNumber, { color: theme.muted }]} numberOfLines={1}>
                    {item.number}
                  </Text>
                </View>
                <View style={[styles.deviceChatBadge, { backgroundColor: theme.mint }]}>
                  <Text style={[styles.deviceChatBadgeText, { color: theme.emerald }]}>Chat</Text>
                </View>
              </ScalePressable>
            )}
          />
        </View>
      </Modal>
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