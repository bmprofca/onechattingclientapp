import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  TextInput,
} from 'react-native';
import { Search, Plus, Megaphone } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getCampaigns, ListItem, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';

import { ScalePressable, FadeInView } from '../components/animations';

export function CampaignsScreen({
  projectId,
  session,
  onOpenCampaign,
  onCreateCampaign,
}: {
  projectId: string;
  session: ApiSession;
  onOpenCampaign: (campaignId: string, name: string) => void;
  onCreateCampaign?: () => void;
}) {
  const theme = useTheme();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'all' | 'completed'>('all');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const name = String(item.name || item.campaign_name || 'Untitled').toLowerCase();
      const status = String(item.status || 'Active').toLowerCase();
      
      const matchesSearch = name.includes(searchQuery.toLowerCase());
      
      if (mode === 'completed') {
        return matchesSearch && (status === 'completed' || status === 'complete');
      }
      return matchesSearch;
    });
  }, [items, searchQuery, mode]);

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
    <View style={{ flex: 1, backgroundColor: theme.canvas }}>
      <FadeInView direction="down" distance={10} duration={300} style={styles.heading}>
        {/* Search Bar + Create Button */}
        <View style={styles.topRow}>
          <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Search size={18} color={theme.muted} />
            <TextInput
              style={[styles.searchInput, { color: theme.ink }]}
              placeholder="Search campaigns..."
              placeholderTextColor={theme.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>
          {onCreateCampaign && (
            <ScalePressable
              accessibilityRole="button"
              onPress={onCreateCampaign}
              style={[styles.createBtn, { backgroundColor: theme.emerald }]}
            >
              <Plus size={18} color="#FFF" />
              <Text style={styles.createBtnText}>New</Text>
            </ScalePressable>
          )}
        </View>

        <View style={[styles.segmented, { backgroundColor: theme.cardHover }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMode('all')}
            style={[
              styles.segment,
              mode === 'all' && { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: mode === 'all' ? theme.emerald : theme.muted },
              ]}
            >
              All
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMode('completed')}
            style={[
              styles.segment,
              mode === 'completed' && { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: mode === 'completed' ? theme.emerald : theme.muted },
              ]}
            >
              Completed
            </Text>
          </Pressable>
        </View>
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
      </FadeInView>

      <FlatList
        data={filteredItems}
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
        ListEmptyComponent={
          <LoadState
            loading={false}
            error={error}
            empty={!loading && !error}
            onRetry={load}
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index * 35, 250)} distance={10}>
            <CampaignCard item={item} onPress={onOpenCampaign} />
          </FadeInView>
        )}
      />
    </View>
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
    <ScalePressable
      accessibilityRole="button"
      onPress={() => onPress(campaignId, name)}
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
        <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.ink }]}>
          {name}
        </Text>
        <Text numberOfLines={2} style={[styles.cardDetail, { color: theme.muted }]}>
          {detail}
        </Text>
        <Text style={[styles.cardMeta, { color: theme.emerald }]}>{status}</Text>
      </View>
      <Text style={[styles.arrow, { color: theme.muted }]}>›</Text>
    </ScalePressable>
  );
}
const styles = StyleSheet.create({
  heading: { paddingTop: 12, paddingBottom: 0, paddingHorizontal: 10 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
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
  emptyList: { flexGrow: 1, paddingHorizontal: 20 },
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
    textTransform: 'uppercase',
    marginTop: 6,
  },
  arrow: { fontSize: 24, lineHeight: 26, marginLeft: 4 },
});