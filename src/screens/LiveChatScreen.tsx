import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { getInbox, getOpenCases, ListItem, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';

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
  const [mode, setMode] = useState<'chats' | 'cases'>('chats');
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState('');
  const [newChatName, setNewChatName] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(
        unwrapList(
          await (mode === 'chats' ? getInbox : getOpenCases)(
            session,
            projectId,
            debouncedSearchQuery
          ),
        ),
      );
    } catch (requestError) {
      setItems([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load this data.',
      );
    } finally {
      setLoading(false);
    }
  }, [mode, projectId, session, debouncedSearchQuery]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubChat = socketManager.onChat((data) => {
      setItems((prev) => {
        const contactNum = data.contact?.number;
        if (!contactNum) return prev;
        
        const existingIdx = prev.findIndex(c => {
          const cNum = (c.contact as Record<string, any>)?.number || c.phone || c.number;
          return String(cNum) === String(contactNum);
        });
        
        const newChat: any = existingIdx >= 0 ? { ...prev[existingIdx] } : { contact: data.contact, number: contactNum, unread_count: 0 };
        
        newChat.last_message = data.message;
        if (data.message.type === 'in' && data.message.status !== 'read') {
          newChat.unread_count = Number(newChat.unread_count || 0) + 1;
        }
        
        const nextList = [...prev];
        if (existingIdx >= 0) {
          nextList.splice(existingIdx, 1);
        }
        
        // Only add to list if it fits the current mode, but for simplicity we'll just push to top
        // If mode is 'cases' and this isn't an open case, it might technically not belong, 
        // but it's fine for an optimistic update until they refresh.
        nextList.unshift(newChat);
        return nextList;
      });
    });

    return () => {
      unsubChat();
    };
  }, []);

  const handleDirectChat = () => {
    if (!newChatNumber.trim()) return;
    onOpenChat(newChatNumber.trim(), newChatName.trim() || newChatNumber.trim());
    setIsModalVisible(false);
    setNewChatNumber('');
    setNewChatName('');
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas }}>
      <View style={styles.heading}>
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
        <View style={[styles.segmented]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMode('chats')}
            style={[
              styles.segment,
              mode === 'chats' && { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: mode === 'chats' ? theme.emerald : theme.muted },
              ]}
            >
              Live chat
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMode('cases')}
            style={[
              styles.segment,
              mode === 'cases' && { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: mode === 'cases' ? theme.emerald : theme.muted },
              ]}
            >
              Open cases
            </Text>
          </Pressable>
        </View>
      </View>
      
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id || item._id || index)}
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={theme.emerald}
          />
        }
      ListEmptyComponent={
        <LoadState
          loading={false}
          error={error}
          empty={!loading && !error}
          onRetry={load}
        />
      }
      renderItem={({ item }) => (
        <ChatCard 
          item={item} 
          onPress={(contactNumber, contactName) => onOpenChat(contactNumber, contactName)} 
        />
      )}
    />

      {/* FAB */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsModalVisible(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.emerald },
          pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }
        ]}
      >
        <MessageSquarePlus size={24} color="#FFF" />
      </Pressable>

      {/* Direct Chat Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.ink }]}>New Chat</Text>
              <Pressable onPress={() => setIsModalVisible(false)} hitSlop={8}>
                <X size={24} color={theme.muted} />
              </Pressable>
            </View>
            
            <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
              Enter a phone number with country code to start a new direct chat.
            </Text>

            <View style={[styles.inputWrapper, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
              <TextInput
                style={[styles.modalInput, { color: theme.ink }]}
                placeholder="Phone Number (e.g. 919876543210)"
                placeholderTextColor={theme.muted}
                keyboardType="phone-pad"
                value={newChatNumber}
                onChangeText={setNewChatNumber}
              />
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
              <TextInput
                style={[styles.modalInput, { color: theme.ink }]}
                placeholder="Contact Name (Optional)"
                placeholderTextColor={theme.muted}
                value={newChatName}
                onChangeText={setNewChatName}
              />
            </View>

            <Pressable
              style={[styles.modalButton, { backgroundColor: theme.emerald }]}
              onPress={handleDirectChat}
            >
              <Text style={styles.modalButtonText}>Start Conversation</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ChatCard({ item, onPress }: { item: ListItem, onPress: (contactNumber: string, contactName: string) => void }) {
  const theme = useTheme();
  const contact = (item.contact as Record<string, any>) || {};
  const lastMessage = (item.last_message as Record<string, any>) || {};
  
  const contactNumber = String(contact.number || '');
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
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(contactNumber, name)}
      style={[
        styles.card,
      ]}
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
              {new Date(lastMessage.create_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </Text>
          )}
        </View>
        <Text numberOfLines={1} style={[styles.cardDetail, { color: theme.muted }]}>
          {detail}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.cardMeta, { color: theme.muted }]}>Unread Messages</Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.emerald }]}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.arrow, { color: theme.muted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: 12, paddingBottom: 0, paddingHorizontal: 10 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 15,
  },
  segmented: {
    height: 40,
    marginTop: 2,
    padding: 3,
    borderRadius: 12,
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentText: { fontSize: 13, fontWeight: '700' },
  rule: { height: 1, marginTop: 8 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
