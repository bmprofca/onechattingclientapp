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
import { getCampaigns, ListItem, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { colors } from '../theme/theme';

export function CampaignsScreen({
  projectId,
  session,
}: {
  projectId: string;
  session: ApiSession;
}) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(unwrapList(await getCampaigns(session, projectId)));
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
  }, [projectId, session]);
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
          tintColor={colors.emerald}
        />
      }
      ListHeaderComponent={
        <View style={styles.heading}>
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
      renderItem={({ item }) => <CampaignCard item={item} />}
    />
  );
}
function CampaignCard({ item }: { item: ListItem }) {
  const name = String(item.name || item.campaign_name || 'Untitled');
  const detail = String(
    item.message || item.status || item.category || 'No details available',
  );
  const status = String(item.status || 'Active');
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
        <Text style={styles.cardMeta}>{status}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  heading: { paddingTop: 12, paddingBottom: 5 },
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
    backgroundColor: '#FFF1D6',
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
