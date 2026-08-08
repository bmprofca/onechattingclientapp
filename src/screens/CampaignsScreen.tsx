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
import { useTheme } from '../theme/theme';

export function CampaignsScreen({
  projectId,
  session,
  onOpenCampaign,
}: {
  projectId: string;
  session: ApiSession;
  onOpenCampaign: (campaignId: string, name: string) => void;
}) {
  const theme = useTheme();
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
      keyExtractor={(item, index) =>
        String(item.campaign_id || item.id || item._id || index)
      }
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
        <CampaignCard item={item} onPress={onOpenCampaign} />
      )}
    />
  );
}
function CampaignCard({
  item,
  onPress,
}: {
  item: ListItem;
  onPress: (campaignId: string, name: string) => void;
}) {
  const theme = useTheme();
  const name = String(item.name || item.campaign_name || 'Untitled');
  const campaignId = String(item.campaign_id || item.id || item._id || '');
  const detail = String(
    item.message || item.status || item.category || 'No details available',
  );
  const status = String(item.status || 'Active');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(campaignId, name)}
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
        <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.ink }]}>
          {name}
        </Text>
        <Text numberOfLines={2} style={[styles.cardDetail, { color: theme.muted }]}>
          {detail}
        </Text>
        <Text style={[styles.cardMeta, { color: theme.emerald }]}>{status}</Text>
      </View>
      <Text style={[styles.arrow, { color: theme.muted }]}>›</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  heading: { paddingTop: 12, paddingBottom: 5 },
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
  arrow: { fontSize: 24, lineHeight: 26, marginLeft: 4 },
});