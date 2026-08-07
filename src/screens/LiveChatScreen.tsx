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
import { colors } from '../theme/theme';

export function LiveChatScreen({
  projectId,
  session,
}: {
  projectId: string;
  session: ApiSession;
}) {
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
  const title = mode === 'cases' ? 'Open cases' : 'Inbox';
  const subtitle =
    mode === 'cases'
      ? 'Customer issues assigned to your workspace'
      : 'Live conversations and open cases';
  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(item.id || item._id || index)}
      contentContainerStyle={items.length ? styles.list : styles.emptyList}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={colors.emerald}
        />
      }
      ListHeaderComponent={
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.segmented}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('chats')}
              style={[styles.segment, mode === 'chats' && styles.activeSegment]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'chats' && styles.activeSegmentText,
                ]}
              >
                Live chat
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('cases')}
              style={[styles.segment, mode === 'cases' && styles.activeSegment]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'cases' && styles.activeSegmentText,
                ]}
              >
                Open cases
              </Text>
            </Pressable>
          </View>
          <View style={styles.rule} />
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
      renderItem={({ item }) => <ChatCard item={item} />}
    />
  );
}
function ChatCard({ item }: { item: ListItem }) {
  const name = String(
    item.name || item.contact_name || item.phone || 'Untitled',
  );
  const detail = String(
    item.message ||
      item.status ||
      item.phone ||
      item.email ||
      'No details available',
  );
  return (
    <Pressable accessibilityRole="button" style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {name.trim().charAt(0).toUpperCase() || '1'}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {name}
        </Text>
        <Text numberOfLines={2} style={styles.cardDetail}>
          {detail}
        </Text>
        <Text style={styles.cardMeta}>Conversation</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  heading: { paddingTop: 21, paddingBottom: 5 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: colors.ink,
  },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 5 },
  segmented: {
    height: 40,
    marginTop: 17,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#EAF0ED',
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  activeSegment: { backgroundColor: '#FFF' },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  activeSegmentText: { color: colors.emerald },
  rule: { height: 1, backgroundColor: colors.border, marginTop: 17 },
  list: { paddingHorizontal: 20, paddingBottom: 18 },
  emptyList: { flexGrow: 1, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#DFF5E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  cardDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  cardMeta: {
    color: colors.emerald,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  arrow: { color: '#9BA9A2', fontSize: 28, lineHeight: 28 },
});
