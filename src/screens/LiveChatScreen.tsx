import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiSession } from '../api/client';
import { getInbox, getOpenCases, ListItem, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';

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
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(
        unwrapList(
          await (mode === 'chats' ? getInbox : getOpenCases)(
            session,
            projectId,
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
  }, [mode, projectId, session]);
  useEffect(() => {
    load();
  }, [load]);
  return (
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
      ListHeaderComponent={
        <View style={styles.heading}>
          <View style={[styles.segmented, { backgroundColor: theme.cardHover }]}>
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
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
        </View>
      }
      ListEmptyComponent={
        <LoadState
          loading={loading}
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
        { backgroundColor: theme.surface, borderColor: theme.border },
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
        <Text numberOfLines={2} style={[styles.cardDetail, { color: theme.muted }]}>
          {detail}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.cardMeta, { color: theme.emerald }]}>Conversation</Text>
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
  heading: { paddingTop: 12, paddingBottom: 5 },
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
  rule: { height: 1, marginTop: 17 },
  list: { paddingHorizontal: 20, paddingBottom: 18 },
  emptyList: { flexGrow: 1, paddingHorizontal: 20 },
  card: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 13,
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
    textTransform: 'uppercase',
    marginTop: 6,
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
});
