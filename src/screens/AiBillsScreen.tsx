import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ArrowLeft, RefreshCw, Calendar, FileText, IndianRupee } from 'lucide-react-native';
import { useTheme } from '../theme/theme';
import { ApiSession, get } from '../api/client';

// ---- Types ----

type AiBill = {
  transaction_id?: string;
  create_date?: string;
  project_id?: string;
  transaction_type?: string;
  remark?: string;
  amount?: number | string;
};

type AiBillsResponse = {
  data?: AiBill[];
  summary?: { total_bills?: number; total_amount?: number };
  pagination?: { page?: number; limit?: number; total_records?: number; total_pages?: number };
  error?: boolean | string;
  message?: string;
};

type RangeKey = '7' | '30' | '90' | 'all';

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '7', label: '7D', days: 7 },
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: 'all', label: 'All', days: null },
];

const PAGE_SIZE = 20;

// ---- Helpers ----

const pad = (n: number) => String(n).padStart(2, '0');

const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const rangeToDates = (range: RangeKey): { fromDate?: string; toDate?: string } => {
  const def = RANGES.find(r => r.key === range);
  if (!def || def.days === null) return {};
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - def.days);
  return { fromDate: toIsoDate(from), toDate: toIsoDate(to) };
};

// Server dates may come back as "YYYY-MM-DD HH:mm:ss" or ISO; normalize
// the space to a "T" so `new Date(...)` parses it consistently.
const parseServerDate = (value?: string): Date | null => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

const formatDateParts = (value?: string): { date: string; time: string } => {
  const d = parseServerDate(value);
  if (!d) return { date: 'N/A', time: '' };
  const date = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return { date, time };
};

const currency = (amount: unknown) => `\u20B9${(Number(amount) || 0).toFixed(2)}`;

// ---- Component ----

export function AiBillsScreen({
  projectId,
  session,
  onBack,
}: {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
}) {
  const theme = useTheme();

  const [bills, setBills] = useState<AiBill[]>([]);
  const [summary, setSummary] = useState({ total_bills: 0, total_amount: 0 });
  const [range, setRange] = useState<RangeKey>('30');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true); // initial full-screen load
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [loadingMore, setLoadingMore] = useState(false); // infinite scroll
  const [error, setError] = useState('');

  // Guards against out-of-order responses if the range changes mid-fetch.
  const requestId = useRef(0);

  const fetchBills = useCallback(
    async (pageNum: number, mode: 'initial' | 'refresh' | 'more', activeRange: RangeKey) => {
      const myRequestId = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      setError('');

      try {
        const { fromDate, toDate } = rangeToDates(activeRange);
        const params = new URLSearchParams({
          project_id: projectId,
          page: String(pageNum),
          limit: String(PAGE_SIZE),
          ...(fromDate ? { from_date: fromDate } : {}),
          ...(toDate ? { to_date: toDate } : {}),
        });

        const response = await get<AiBillsResponse>(
          `/account/ai-bills?${params.toString()}`,
          undefined,
          session,
        );
        if (myRequestId !== requestId.current) return; // a newer request superseded this one

        if (response.error) {
          setError(response.message || 'Failed to fetch AI bills.');
          return;
        }

        const incoming = Array.isArray(response.data) ? response.data : [];
        const pagination = response.pagination || {};
        setBills(prev => (mode === 'more' ? [...prev, ...incoming] : incoming));
        setSummary({
          total_bills: response.summary?.total_bills || 0,
          total_amount: response.summary?.total_amount || 0,
        });
        setPage(Number(pagination.page) || pageNum);
        setTotalPages(Number(pagination.total_pages) || 1);
      } catch (err: any) {
        if (myRequestId !== requestId.current) return;
        setError(err?.message || 'Failed to fetch AI bills. Please try again.');
      } finally {
        if (myRequestId !== requestId.current) return;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [projectId, session],
  );

  // Reload from page 1 whenever the range filter changes.
  useEffect(() => {
    fetchBills(1, 'initial', range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const handleRefresh = () => fetchBills(1, 'refresh', range);

  const handleLoadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    fetchBills(page + 1, 'more', range);
  };

  const renderItem = ({ item, index }: { item: AiBill; index: number }) => {
    const { date, time } = formatDateParts(item.create_date);
    return (
      <View key={item.transaction_id || index} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={[styles.typeBadge, { backgroundColor: theme.cardHover }]}>
              <Text style={[styles.typeBadgeText, { color: theme.mintText || theme.emerald }]}>
                {item.transaction_type || 'AI bill'}
              </Text>
            </View>
            <View style={styles.dateRow}>
              <Calendar size={12} color={theme.muted} />
              <Text style={[styles.dateText, { color: theme.muted }]}>{date} {time}</Text>
            </View>
          </View>
          <Text style={[styles.amountText, { color: theme.danger }]}>{currency(item.amount)}</Text>
        </View>
        <Text style={[styles.remarkText, { color: theme.ink }]} numberOfLines={3}>
          {item.remark || 'No remark provided.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
            <ArrowLeft size={24} color={theme.ink} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>AI Bills</Text>
        </View>
        <Pressable onPress={handleRefresh} disabled={loading || refreshing} hitSlop={12} style={styles.iconBtn}>
          <RefreshCw size={20} color={theme.ink} style={refreshing ? styles.spin : undefined} />
        </Pressable>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.summaryIconBg, { backgroundColor: theme.cardHover }]}>
            <FileText size={18} color={theme.emerald} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: theme.muted }]}>Total bills</Text>
            <Text style={[styles.summaryValue, { color: theme.ink }]}>{summary.total_bills || 0}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.summaryIconBg, { backgroundColor: theme.cardHover }]}>
            <IndianRupee size={18} color={theme.danger} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: theme.muted }]}>Total amount</Text>
            <Text style={[styles.summaryValue, { color: theme.ink }]}>{currency(summary.total_amount)}</Text>
          </View>
        </View>
      </View>

      {/* Range filter chips */}
      <View style={styles.chipRow}>
        {RANGES.map(r => {
          const active = range === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              style={[
                styles.chip,
                { borderColor: theme.border, backgroundColor: active ? theme.mint : theme.surface },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? theme.mintText || theme.emerald : theme.ink }]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.emerald} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable onPress={() => fetchBills(1, 'initial', range)} style={[styles.retryBtn, { backgroundColor: theme.emerald }]}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item, index) => item.transaction_id || String(index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.emerald} />}
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
          ListEmptyComponent={
            <View style={styles.center}>
              <FileText size={32} color={theme.muted} style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.muted }}>No AI bills found for this range.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={theme.emerald} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  spin: { transform: [{ rotate: '45deg' }] },

  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 16 },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  summaryIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 17, fontWeight: '800', marginTop: 2 },

  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },

  listContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  errorText: { textAlign: 'center', marginBottom: 14, fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFF', fontWeight: '700' },

  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  dateText: { fontSize: 12 },
  amountText: { fontSize: 15, fontWeight: '800' },
  remarkText: { fontSize: 13, marginTop: 10, lineHeight: 18 },
});
