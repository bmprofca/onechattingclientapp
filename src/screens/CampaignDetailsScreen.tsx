import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, Check, CheckCheck, X, Clock3 } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import {
  getCampaignDetails,
  getCampaignMessages,
  ListItem,
  unwrapItem,
  unwrapList,
} from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';

type Recipients = {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};
type Cost = { total: number; per_message: number; used: number };
type Template = { template_name: string; category: string; language_code: string };
type CampaignDetails = {
  campaign_id: string;
  name: string;
  status: string;
  create_date: string;
  source: string;
  template: Template;
  recipients: Recipients;
  cost: Cost;
};

// Scoped to this screen — covers read/pending/failed states the shared
// theme doesn't define.
const ACCENTS = {
  read: '#4FA8E0',
  delivered: '#3ECF8E',
  pending: '#E8A23C',
  failed: '#E15C5C',
};

export function CampaignDetailsScreen({
  projectId,
  session,
  campaignId,
  campaignName,
  onBack,
}: {
  projectId: string;
  session: ApiSession;
  campaignId: string;
  campaignName?: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [details, setDetails] = useState<CampaignDetails | null>(null);
  const [messages, setMessages] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Same two calls the web console fires on open: campaign-messages
      // then campaign-details. post() already throws ApiError on
      // {error: true}, so no manual error check needed here.
      const [messagesRes, detailsRes] = await Promise.all([
        getCampaignMessages(session, projectId, campaignId),
        getCampaignDetails(session, projectId, campaignId),
      ]);
      setMessages(unwrapList(messagesRes));
      setDetails(unwrapItem(detailsRes) as CampaignDetails);
    } catch (requestError) {
      setDetails(null);
      setMessages([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load this campaign.',
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId, projectId, session]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || error || !details) {
    return (
      <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
        <ScreenHeader title={campaignName || 'Campaign'} onBack={onBack} theme={theme} />
        <LoadState
          loading={loading}
          error={error}
          empty={!loading && !error && !details}
          onRetry={load}
        />
      </View>
    );
  }

  const r = details.recipients;
  const cost = details.cost;
  const template = details.template;
  const deliveredOnly = Math.max((r?.delivered || 0) - (r?.read || 0), 0);
  const total = r?.total || 0;

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <ScreenHeader title={details.name} onBack={onBack} theme={theme} />
      <FlatList
        data={messages}
        keyExtractor={(item, index) => String(item.id || item._id || index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.emerald} />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <View style={[styles.badge, { backgroundColor: theme.mint }]}>
                  <Text style={[styles.badgeText, { color: theme.mintText }]}>
                    {template?.category || '—'}
                  </Text>
                </View>
                <StatusChip status={details.status} theme={theme} />
              </View>
              <Text style={[styles.templateName, { color: theme.ink }]}>
                {template?.template_name || '—'}
              </Text>
              <Text style={[styles.metaText, { color: theme.muted }]}>
                Created {details.create_date} · {details.source}
              </Text>
            </View>

            <SectionLabel label={`Recipients — ${total} total`} theme={theme} />
            {total > 0 ? (
              <>
                <View style={[styles.funnel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={{ flex: deliveredOnly || 0.0001, backgroundColor: ACCENTS.delivered }} />
                  <View style={{ flex: r.read || 0.0001, backgroundColor: ACCENTS.read }} />
                  <View style={{ flex: r.pending || 0.0001, backgroundColor: ACCENTS.pending }} />
                  <View style={{ flex: r.failed || 0.0001, backgroundColor: ACCENTS.failed }} />
                </View>
                <View style={styles.legendRow}>
                  <LegendItem color={ACCENTS.delivered} label="sent" value={r.sent} theme={theme} />
                  <LegendItem color={ACCENTS.read} label="read" value={r.read} theme={theme} />
                  <LegendItem color={ACCENTS.pending} label="pending" value={r.pending} theme={theme} />
                  <LegendItem color={ACCENTS.failed} label="failed" value={r.failed} theme={theme} />
                </View>
              </>
            ) : (
              <Text style={[styles.emptyLog, { color: theme.muted }]}>No recipients yet</Text>
            )}

            <SectionLabel label="Cost" theme={theme} />
            <View style={styles.costRow}>
              <CostCell label="Total" value={cost?.total} theme={theme} />
              <CostCell label="Per message" value={cost?.per_message} theme={theme} />
              <CostCell label="Used" value={cost?.used} theme={theme} />
            </View>

            <SectionLabel label="Message log" theme={theme} />
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.emptyLog, { color: theme.muted }]}>No messages sent yet</Text>
        }
        renderItem={({ item }) => <MessageRow item={item} theme={theme} />}
      />
    </View>
  );
}

function ScreenHeader({
  title,
  onBack,
  theme,
}: {
  title: string;
  onBack: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={8}
      >
        <ChevronLeft size={22} color={theme.mintText} strokeWidth={2.5} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink }]}>
        {title}
      </Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function SectionLabel({ label, theme }: { label: string; theme: ReturnType<typeof useTheme> }) {
  return <Text style={[styles.sectionLabel, { color: theme.muted }]}>{label}</Text>;
}

function LegendItem({
  color,
  label,
  value,
  theme,
}: {
  color: string;
  label: string;
  value: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendValue, { color: theme.ink }]}>{value ?? 0}</Text>
      <Text style={[styles.legendLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function CostCell({
  label,
  value,
  theme,
}: {
  label: string;
  value?: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.costCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.costValue, { color: theme.ink }]}>₹{Number(value ?? 0).toFixed(2)}</Text>
      <Text style={[styles.costLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function StatusChip({ status, theme }: { status: string; theme: ReturnType<typeof useTheme> }) {
  const color =
    status === 'complete' ? ACCENTS.delivered
    : status === 'running' ? theme.emerald
    : status === 'scheduled' ? ACCENTS.pending
    : theme.muted;
  return (
    <View style={[styles.statusChip, { backgroundColor: color + '22' }]}>
      <Text style={[styles.statusChipText, { color }]}>{status}</Text>
    </View>
  );
}

function MessageRow({ item, theme }: { item: ListItem; theme: ReturnType<typeof useTheme> }) {
  const phone = String(item.phone || item.number || item.mobile || '—');
  const time = item.create_date
    ? new Date(String(item.create_date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const status = String(item.status || 'pending');
  return (
    <View style={[styles.logRow, { borderColor: theme.border }]}>
      <View style={styles.logLeft}>
        <Text style={[styles.logTime, { color: theme.muted }]}>{time}</Text>
        <Text style={[styles.logPhone, { color: theme.ink }]}>{phone}</Text>
      </View>
      <View style={styles.logRight}>
        <Text style={[styles.logStatusText, { color: theme.muted }]}>{status}</Text>
        <StatusIcon status={status} />
      </View>
    </View>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck size={16} color={ACCENTS.read} strokeWidth={2.4} />;
  if (status === 'delivered') return <CheckCheck size={16} color="#8B979C" strokeWidth={2.4} />;
  if (status === 'sent') return <Check size={16} color="#8B979C" strokeWidth={2.4} />;
  if (status === 'failed') return <X size={16} color={ACCENTS.failed} strokeWidth={2.4} />;
  return <Clock3 size={14} color="#5C666B" strokeWidth={2.2} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { borderRadius: 17, borderWidth: 1, padding: 14, marginTop: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  templateName: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  metaText: { fontSize: 12, marginTop: 4 },
  statusChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  statusChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
  },
  funnel: { height: 30, borderRadius: 9, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  legendValue: { fontSize: 14, fontWeight: '800' },
  legendLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  costRow: { flexDirection: 'row', gap: 8 },
  costCell: { flex: 1, borderRadius: 13, borderWidth: 1, padding: 12 },
  costValue: { fontSize: 16, fontWeight: '800' },
  costLabel: { fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  emptyLog: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logTime: { fontSize: 11, width: 44 },
  logPhone: { fontSize: 13, fontWeight: '600' },
  logRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logStatusText: { fontSize: 11, textTransform: 'capitalize' },
});