import { ScreenSkeleton } from '../components/Skeleton';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  Edit2,
  MessageCircle,
  FileText,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getCaseList } from '../api/workspace';
import { useTheme, radii, cardShadow } from '../theme/theme';
import { ScalePressable } from '../components/animations';

type Props = {
  projectId: string;
  session: ApiSession;
  contactNumber: string;
  contactName?: string;
  initialCaseName?: string;
  onBack: () => void;
  onOpenChat: (contactNumber: string, contactName: string) => void;
  onEditCase: (caseItem: any) => void;
};

const parseServerDate = (value: any): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const formatDateOnly = (value: any): string => {
  if (!value) return '-';
  const d = parseServerDate(value);
  if (!d) return '-';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function CaseDetailsScreen({
  projectId,
  session,
  contactNumber,
  contactName,
  initialCaseName,
  onBack,
  onOpenChat,
  onEditCase,
}: Props) {
  const theme = useTheme();

  const [caseList, setCaseList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialCaseName || '');
  const [statusFilter, setStatusFilter] = useState<'' | 'open' | 'closed'>('');

  const fetchCases = useCallback(
    async (searchQuery?: string, status?: string) => {
      if (!projectId || !session?.token || !contactNumber) return;
      setLoading(true);
      setError('');
      try {
        const res = await getCaseList(session, projectId, {
          number: contactNumber,
          search: searchQuery !== undefined ? searchQuery : search,
          status: status !== undefined ? status : statusFilter,
        });
        if (res?.error) {
          setError(
            typeof res.error === 'string'
              ? res.error
              : res.message || 'Failed to load cases',
          );
          setCaseList([]);
          return;
        }
        const list = res?.data ?? res?.list ?? [];
        setCaseList(Array.isArray(list) ? list : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load case list');
        setCaseList([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId, session.token, session.username, contactNumber, search, statusFilter],
  );

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const displayName = contactName || contactNumber;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Standalone Full-Screen Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.header, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.headerLeft}>
          <ScalePressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
          </ScalePressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.ink }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]} numberOfLines={1}>
              {contactNumber} · Case History
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ScalePressable
            onPress={() => onOpenChat(contactNumber, displayName)}
            style={[styles.chatHeaderBtn, { backgroundColor: theme.primary }]}
            hitSlop={6}
          >
            <MessageCircle size={16} color={theme.onPrimary} />
            <Text style={[styles.chatHeaderBtnText, { color: theme.onPrimary }]}>Chat</Text>
          </ScalePressable>
        </View>
      </View>

      {/* Filter and Search Bar */}
      <View
        style={[
          styles.filtersRow,
          {
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.fieldBg },
          ]}
        >
          <Search size={18} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={(val) => {
              setSearch(val);
              fetchCases(val, statusFilter);
            }}
            placeholder="Filter cases by title or remark"
            placeholderTextColor={theme.placeholder}
            style={[styles.searchInput, { color: theme.ink }]}
          />
          {search.length > 0 && (
            <Pressable
              hitSlop={8}
              onPress={() => {
                setSearch('');
                fetchCases('', statusFilter);
              }}
            >
              <Text style={{ color: theme.muted, fontSize: 14 }}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.filterChipsRow}>
          {(['', 'open', 'closed'] as const).map((st) => {
            const active = statusFilter === st;
            const label = st === '' ? 'All' : st === 'open' ? 'Open' : 'Closed';
            return (
              <Pressable
                key={st}
                onPress={() => {
                  setStatusFilter(st);
                  fetchCases(search, st);
                }}
                style={[
                  styles.filterChip,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  active && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? theme.onPrimary : theme.inkSoft },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Case List Body */}
      {loading && caseList.length === 0 ? (
        <ScreenSkeleton variant="detail" />
      ) : error ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: theme.danger }}>{error}</Text>
        </View>
      ) : caseList.length === 0 ? (
        <View style={{ paddingVertical: 50, alignItems: 'center' }}>
          <FileText size={36} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.ink, marginTop: 12 }]}>
            No cases found
          </Text>
          <Text style={[styles.emptyCopy, { color: theme.muted }]}>
            No cases match the selected filter.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => fetchCases(search, statusFilter)}
              tintColor={theme.emerald}
            />
          }
        >
          {caseList.map((row: any, idx: number) => {
            const isOpen =
              row.status === true || row.status === '1' || row.status === 'open';
            const createDate =
              row.created_at ||
              row.create_date ||
              row.createdAt ||
              row.created_date;

            return (
              <View
                key={row.id || row.case_id || idx}
                style={[
                  styles.caseCard,
                  cardShadow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <View style={styles.caseCardHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.caseCardTitle, { color: theme.ink }]}>
                      {row.name || 'Untitled Case'}
                    </Text>
                    <Text style={[styles.caseDate, { color: theme.muted }]}>
                      Created: {formatDateOnly(createDate)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: isOpen ? theme.mint : theme.fieldBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: isOpen ? theme.mintText : theme.inkSoft },
                        ]}
                      >
                        {isOpen ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                    <ScalePressable
                      onPress={() => onEditCase(row)}
                      style={[
                        styles.editCaseBtn,
                        { backgroundColor: theme.fieldBg, borderColor: theme.fieldBg },
                      ]}
                      hitSlop={6}
                    >
                      <Edit2 size={13} color={theme.emerald} />
                    </ScalePressable>
                  </View>
                </View>

                {row.remark ? (
                  <View
                    style={[styles.remarkBox, { backgroundColor: theme.fieldBg }]}
                  >
                    <Text style={[styles.remarkText, { color: theme.inkSoft }]}>
                      {row.remark}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  chatHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  chatHeaderBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  caseCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
  },
  caseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caseCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  caseDate: {
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editCaseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remarkBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: radii.sm,
  },
  remarkText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCopy: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
