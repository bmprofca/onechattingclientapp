import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Animated,
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
import { SearchClearButton } from '../components/SearchClearButton';
import { ScreenSkeleton } from '../components/Skeleton';
import { useTheme, radii, space, type, cardShadow } from '../theme/theme';

import { ScalePressable, FadeInView } from '../components/animations';
import { useKeyboardContext } from '../contexts/KeyboardContext';

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
  const { isKeyboardVisible, keyboardHeightAnim } = useKeyboardContext();
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
  }, [projectId, session.token, session.username]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Animated.View
      style={[
        { flex: 1, backgroundColor: theme.canvas },
        { paddingBottom: keyboardHeightAnim },
      ]}
    >
      <FadeInView
        direction="down"
        distance={10}
        duration={300}
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        {!isKeyboardVisible && (
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: theme.ink }]}>Campaigns</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                {items.length} campaign{items.length === 1 ? '' : 's'}
              </Text>
            </View>
            {onCreateCampaign && (
              <ScalePressable
                accessibilityRole="button"
                accessibilityLabel="New campaign"
                onPress={onCreateCampaign}
                style={[styles.newBtn, { backgroundColor: theme.primary }]}
              >
                <Plus size={16} color={theme.onPrimary} strokeWidth={2.6} />
                <Text style={[styles.newBtnText, { color: theme.onPrimary }]}>
                  New campaign
                </Text>
              </ScalePressable>
            )}
          </View>
        )}

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.fieldBg }]}>
          <Search size={18} color={theme.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.ink }]}
            placeholder="Search campaigns"
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          <SearchClearButton value={searchQuery} onClear={() => setSearchQuery('')} color={theme.muted} />
        </View>

        <View style={[styles.segmented, { backgroundColor: theme.fieldBg }]}>
          {(['all', 'completed'] as const).map((key) => {
            const active = mode === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(key)}
                style={[
                  styles.segment,
                  active && [
                    styles.segmentActive,
                    { backgroundColor: theme.surface, shadowColor: theme.shadow },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? theme.ink : theme.muted },
                  ]}
                >
                  {key === 'all' ? 'All' : 'Completed'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FadeInView>

      <FlatList
        data={filteredItems}
        keyExtractor={(item, index) =>
          String(item.campaign_id || item.id || item._id || index)
        }
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={load}
            tintColor={theme.emerald}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="chat" />
          ) : (
            <LoadState
              loading={false}
              error={error}
              empty={!error}
              onRetry={load}
            />
          )
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index * 35, 250)} distance={10}>
            <CampaignCard item={item} onPress={onOpenCampaign} />
          </FadeInView>
        )}
      />
    </Animated.View>
  );
}

const toNum = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatSchedule = (value: unknown): string => {
  if (!value) return '';
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

  // Presentation-only reads of optional fields the list may carry.
  const anyItem = item as any;
  const templateName = String(
    anyItem.template_name ||
      (typeof anyItem.template === 'string'
        ? anyItem.template
        : anyItem.template?.template_name) ||
      '',
  );
  const recipients =
    anyItem.recipients && typeof anyItem.recipients === 'object'
      ? anyItem.recipients
      : anyItem;
  const total = toNum(recipients.total ?? anyItem.total_contacts ?? anyItem.audience_count);
  const sent = toNum(recipients.sent);
  const delivered = toNum(recipients.delivered);
  const read = toNum(recipients.read);
  const schedule = formatSchedule(
    anyItem.schedule_date || anyItem.scheduled_at || anyItem.create_date,
  );
  const metaParts = [
    templateName,
    total !== null ? `${total} recipient${total === 1 ? '' : 's'}` : '',
    schedule,
  ].filter(Boolean);
  const hasStats = sent !== null || delivered !== null || read !== null;
  const base = Math.max(total || 0, sent || 0, delivered || 0, read || 0);
  const readPct = base ? Math.min((read || 0) / base, 1) : 0;
  const deliveredPct = base
    ? Math.min(Math.max((delivered || 0) - (read || 0), 0) / base, 1 - readPct)
    : 0;

  const lower = status.toLowerCase();
  const tone =
    lower === 'running' || lower === 'active' || lower === 'processing' || lower === 'sending'
      ? { bg: theme.mint, fg: theme.mintText, dot: theme.emerald }
      : lower === 'scheduled' || lower === 'pending' || lower === 'queued'
      ? { bg: theme.infoBg, fg: theme.info, dot: theme.info }
      : lower === 'draft'
      ? { bg: theme.warnBg, fg: theme.warning, dot: theme.warning }
      : lower === 'failed' || lower === 'error' || lower === 'cancelled' || lower === 'canceled'
      ? { bg: theme.dangerBg, fg: theme.danger, dot: theme.danger }
      : { bg: theme.fieldBg, fg: theme.inkSoft, dot: theme.muted };
  const statusLabel =
    lower === 'complete' ? 'Completed' : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <ScalePressable
      accessibilityRole="button"
      activeScale={0.98}
      onPress={() => onPress(campaignId, name)}
      style={[
        styles.card,
        cardShadow,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.iconTile, { backgroundColor: theme.mint }]}>
          <Megaphone size={18} color={theme.mintText} />
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.ink }]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={[styles.cardMeta, { color: theme.muted }]}>
            {metaParts.length ? metaParts.join(' · ') : detail}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
          <Text style={[styles.statusText, { color: tone.fg }]}>{statusLabel}</Text>
        </View>
      </View>

      {hasStats && (
        <View style={styles.statsBlock}>
          <View style={[styles.progressTrack, { backgroundColor: theme.fieldBg }]}>
            <View
              style={{
                width: `${readPct * 100}%`,
                backgroundColor: theme.emerald,
              }}
            />
            <View
              style={{
                width: `${deliveredPct * 100}%`,
                backgroundColor: theme.isDark ? theme.emeraldDark : theme.accent,
                opacity: 0.6,
              }}
            />
          </View>
          <View style={styles.statRow}>
            {sent !== null && (
              <Text style={[styles.statText, { color: theme.inkSoft }]}>
                {sent} <Text style={{ color: theme.muted }}>sent</Text>
              </Text>
            )}
            {delivered !== null && (
              <Text style={[styles.statText, { color: theme.inkSoft }]}>
                {delivered} <Text style={{ color: theme.muted }}>delivered</Text>
              </Text>
            )}
            {read !== null && (
              <Text style={[styles.statText, { color: theme.inkSoft }]}>
                {read} <Text style={{ color: theme.muted }}>read</Text>
              </Text>
            )}
          </View>
        </View>
      )}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: space.md,
    paddingBottom: space.sm,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    gap: space.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titleBlock: { flex: 1 },
  title: { ...type.display },
  subtitle: { fontSize: 13, marginTop: 2 },
  newBtn: {
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBtnText: { fontSize: 14, fontWeight: '700' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: radii.md,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    fontSize: 15,
    paddingVertical: 0,
  },
  segmented: {
    padding: 4,
    borderRadius: radii.md,
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  segmentActive: {
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '700' },
  list: { paddingHorizontal: space.md, paddingBottom: space.xl, paddingTop: space.md, gap: 10 },
  emptyList: { flexGrow: 1, paddingHorizontal: space.md },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMeta: { fontSize: 13, marginTop: 3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsBlock: { marginTop: 14 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  statRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  statText: { fontSize: 12, fontWeight: '600' },
});
