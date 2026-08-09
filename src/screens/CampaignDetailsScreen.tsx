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

const ACCENTS = {
  read: '#3B82F6',
  delivered: '#10B981',
  pending: '#F59E0B',
  failed: '#EF4444',
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
            {/* Header Campaign Meta Card */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <View style={[styles.badge, { backgroundColor: theme.mint }]}>
                  <Text style={[styles.badgeText, { color: theme.mintText }]}>
                    {template?.category || 'UTILITY'}
                  </Text>
                </View>
                <StatusChip status={details.status} theme={theme} />
              </View>
              <Text style={[styles.templateName, { color: theme.ink }]}>
                {template?.template_name || details.name || '—'}
              </Text>
              <Text style={[styles.metaText, { color: theme.muted }]}>
                Created {details.create_date} · {details.source || 'contact'}
              </Text>
            </View>

            {/* Recipients Section */}
            <SectionLabel label={`Recipients — ${total} Total`} theme={theme} />
            {total > 0 ? (
              <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.funnel, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                  <View style={{ flex: r.sent || 0.0001, backgroundColor: ACCENTS.delivered }} />
                  <View style={{ flex: r.read || 0.0001, backgroundColor: ACCENTS.read }} />
                  <View style={{ flex: r.pending || 0.0001, backgroundColor: ACCENTS.pending }} />
                  <View style={{ flex: r.failed || 0.0001, backgroundColor: ACCENTS.failed }} />
                </View>
                
                <View style={styles.legendGrid}>
                  <LegendChip color={ACCENTS.delivered} label="Sent" value={r.sent} theme={theme} />
                  <LegendChip color={ACCENTS.read} label="Read" value={r.read} theme={theme} />
                  <LegendChip color={ACCENTS.pending} label="Pending" value={r.pending} theme={theme} />
                  <LegendChip color={ACCENTS.failed} label="Failed" value={r.failed} theme={theme} />
                </View>
              </View>
            ) : (
              <Text style={[styles.emptyLog, { color: theme.muted }]}>No recipients yet</Text>
            )}

            {/* Cost Section */}
            <SectionLabel label="Cost Overview" theme={theme} />
            <View style={styles.costRow}>
              <CostCell label="Total" value={cost?.total} theme={theme} />
              <CostCell label="Per Message" value={cost?.per_message} theme={theme} />
              <CostCell label="Used" value={cost?.used} theme={theme} />
            </View>

            {/* Log Section */}
            <SectionLabel label="Message Log" theme={theme} />
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
        <ChevronLeft size={24} color={theme.emerald} strokeWidth={2.5} />
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

function LegendChip({
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
    <View style={[styles.legendChip, { backgroundColor: theme.isDark ? '#1E293B' : '#F8FAFC', borderColor: theme.border }]}>
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
  const isComplete = status === 'complete' || status === 'completed';
  const color =
    isComplete ? ACCENTS.delivered
    : status === 'running' ? theme.emerald
    : status === 'scheduled' ? ACCENTS.pending
    : theme.muted;
  return (
    <View style={[styles.statusChip, { backgroundColor: color + '20' }]}>
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
        <Text numberOfLines={1} style={[styles.logTime, { color: theme.muted }]}>{time}</Text>
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
  const lower = status.toLowerCase();
  if (lower === 'read') return <CheckCheck size={16} color={ACCENTS.read} strokeWidth={2.4} />;
  if (lower === 'delivered') return <CheckCheck size={16} color="#8B979C" strokeWidth={2.4} />;
  if (lower === 'sent') return <Check size={16} color="#8B979C" strokeWidth={2.4} />;
  if (lower === 'failed') return <X size={16} color={ACCENTS.failed} strokeWidth={2.4} />;
  return <Clock3 size={14} color="#5C666B" strokeWidth={2.2} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 14 },
  sectionCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  templateName: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  metaText: { fontSize: 12, marginTop: 4 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  funnel: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden' },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 8 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendValue: { fontSize: 13, fontWeight: '800' },
  legendLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  costRow: { flexDirection: 'row', gap: 10 },
  costCell: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costValue: { fontSize: 17, fontWeight: '800' },
  costLabel: { fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  emptyLog: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logTime: { fontSize: 11, width: 68 },
  logPhone: { fontSize: 13, fontWeight: '600' },
  logRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logStatusText: { fontSize: 11, textTransform: 'capitalize' },
});