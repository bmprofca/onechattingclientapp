import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  Search,
  Plus,
  Check,
  CheckSquare,
  Filter,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import {
  getOpenCases,
  editCase,
  bulkCloseCases,
} from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import { ScalePressable, FadeInView } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import defaultCaseNames from '../data/caseNames.json';

const parseServerDate = (value: any): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const formatShortDateTime = (value: any): string => {
  if (!value) return '-';
  const d = parseServerDate(value);
  if (!d) return '-';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type Props = {
  projectId: string;
  session: ApiSession;
  onOpenDetails: (contact: { number: string; name?: string }) => void;
  onCreateCase?: (contact?: { name?: string; number: string }) => void;
};

export function OpenCasesScreen({
  projectId,
  session,
  onOpenDetails,
  onCreateCase,
}: Props) {
  const theme = useTheme();

  // --- Main List State ---
  const [casesByNumber, setCasesByNumber] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [caseNameFilter, setCaseNameFilter] = useState('');
  const [caseNameFilterOpen, setCaseNameFilterOpen] = useState(false);

  // --- Multi-Select / Bulk Close State ---
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkCloseLoading, setBulkCloseLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch open cases
  const fetchOpenCases = useCallback(async () => {
    if (!projectId || !session?.token) return;
    setLoading(true);
    setError('');
    try {
      const res = await getOpenCases(
        session,
        projectId,
        debouncedSearch,
        1,
        30,
        caseNameFilter,
        Array.isArray(defaultCaseNames) ? defaultCaseNames : [],
      );
      if (res?.error) {
        setError(
          typeof res.error === 'string'
            ? res.error
            : res.msg || 'Failed to get open cases',
        );
        setCasesByNumber([]);
        setTotal(0);
        return;
      }
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.list)
        ? res.list
        : [];
      const meta = res?.meta || {};
      setCasesByNumber(list);
      setTotal(Number(meta.total) || list.length);
    } catch (err: any) {
      setError(err?.message || 'Failed to get open cases');
      setCasesByNumber([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [projectId, session.token, session.username, debouncedSearch, caseNameFilter]);

  useEffect(() => {
    fetchOpenCases();
  }, [fetchOpenCases]);

  // Socket updates
  useEffect(() => {
    const unsubCase = socketManager.onCaseStatus(() => {
      fetchOpenCases();
    });
    return () => {
      unsubCase();
    };
  }, [fetchOpenCases]);

  const closeSelectedCases = async () => {
    if (!selectedNumbers.length) return;
    const selectedOpenCases = casesByNumber
      .filter((row) =>
        selectedNumbers.includes(String(row.number || row.phone || '')),
      )
      .flatMap((row) => (Array.isArray(row.cases) ? row.cases : []))
      .filter(
        (item: any) =>
          item?.status === true ||
          item?.status === 1 ||
          item?.status === '1' ||
          String(item?.status).toLowerCase() === 'open',
      );
    const caseIds = selectedOpenCases
      .map((item: any) => item.case_id || item.id)
      .filter(Boolean);
    if (!caseIds.length) {
      Toast.show({
        type: 'error',
        text1: 'Nothing to close',
        text2: 'No valid open case IDs were found.',
      });
      return;
    }
    setBulkCloseLoading(true);
    try {
      try {
        const res = await bulkCloseCases(session, projectId, caseIds);
        if (res?.error)
          throw new Error(
            typeof res.error === 'string'
              ? res.error
              : 'Bulk close endpoint failed',
          );
      } catch {
        await Promise.all(
          selectedOpenCases.map((item: any) =>
            editCase(
              session,
              projectId,
              item.case_id || item.id,
              item.name || '',
              item.remark || '',
              'closed',
            ),
          ),
        );
      }
      Toast.show({
        type: 'success',
        text1: 'Cases closed',
        text2: `${caseIds.length} case(s) closed successfully`,
      });
      setSelectedNumbers([]);
      setSelectionMode(false);
      fetchOpenCases();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Bulk close failed',
        text2: err?.message || 'Please try again',
      });
    } finally {
      setBulkCloseLoading(false);
    }
  };

  const toggleAllCases = () => {
    const numbers = casesByNumber
      .map((row) => String(row.number || row.phone || ''))
      .filter(Boolean);
    setSelectedNumbers(
      selectedNumbers.length === numbers.length ? [] : numbers,
    );
  };

  const cancelSelection = () => {
    setSelectedNumbers([]);
    setSelectionMode(false);
  };

  return (
    <KeyboardAvoidView style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Search and Category Filter */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter cases by name"
            onPress={() => setCaseNameFilterOpen(true)}
            style={[
              styles.caseFilterButton,
              caseNameFilter && { backgroundColor: theme.mint },
            ]}
            hitSlop={6}
          >
            <Filter
              size={17}
              color={caseNameFilter ? theme.emerald : theme.muted}
            />
          </Pressable>
          <Search size={18} color={theme.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.ink }]}
            placeholder="Search by name or phone number..."
            placeholderTextColor={theme.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setSearch('')}>
              <Text style={{ color: theme.muted, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>

        {selectionMode && (
          <View style={styles.selectionActions}>
            <Text style={[styles.count, { color: theme.ink }]}>
              {selectedNumbers.length} selected
            </Text>
            <Pressable
              onPress={toggleAllCases}
              style={[styles.selectAllButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.selectAllText, { color: theme.emerald }]}>
                {selectedNumbers.length === casesByNumber.length &&
                casesByNumber.length
                  ? 'Clear'
                  : 'Select all'}
              </Text>
            </Pressable>
            <Pressable
              onPress={cancelSelection}
              style={[styles.cancelButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.selectAllText, { color: theme.muted }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Case Name Filter Modal */}
      <Modal
        visible={caseNameFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCaseNameFilterOpen(false)}
      >
        <Pressable
          style={styles.caseFilterOverlay}
          onPress={() => setCaseNameFilterOpen(false)}
        >
          <Pressable
            style={[
              styles.caseFilterModal,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.caseFilterHeader}>
              <Text style={[styles.caseFilterTitle, { color: theme.ink }]}>
                Filter by case name
              </Text>
              <Pressable onPress={() => setCaseNameFilterOpen(false)} hitSlop={8}>
                <Text style={[styles.caseFilterClose, { color: theme.muted }]}>
                  ×
                </Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.caseFilterList}
              showsVerticalScrollIndicator={false}
            >
              {[
                { label: 'All cases', value: '' },
                ...(Array.isArray(defaultCaseNames) ? defaultCaseNames : []).map(
                  (name: string) => ({ label: name, value: name }),
                ),
                { label: 'Others', value: 'others' },
              ].map((option) => (
                <Pressable
                  key={option.value || 'all'}
                  onPress={() => {
                    setCaseNameFilter(option.value);
                    setCaseNameFilterOpen(false);
                  }}
                  style={[
                    styles.caseFilterOption,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text
                    style={[styles.caseFilterOptionText, { color: theme.ink }]}
                  >
                    {option.label}
                  </Text>
                  {caseNameFilter === option.value ? (
                    <Check size={17} color={theme.emerald} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* List of Cases */}
      <FlatList
        data={casesByNumber}
        keyExtractor={(item, index) =>
          String(item.number || item.phone || index) + '-' + index
        }
        contentContainerStyle={
          casesByNumber.length ? styles.listContent : styles.emptyListContent
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchOpenCases}
            tintColor={theme.emerald}
          />
        }
        ListEmptyComponent={
          <LoadState
            loading={loading}
            error={error}
            empty={!casesByNumber.length}
            emptyTitle="No open cases found"
            emptyCopy="There are no active open cases at the moment."
            onRetry={fetchOpenCases}
          />
        }
        renderItem={({ item, index }) => {
          const contactNum = String(item.number || item.phone || '');
          const contactName = item.contact?.name || item.name || contactNum;
          const rawCases = Array.isArray(item.cases) ? item.cases : [];
          const sortedCases = [...rawCases].sort((a, b) => {
            const dateA = new Date(
              a?.create_date || a?.created_at || a?.createdAt || 0,
            ).getTime();
            const dateB = new Date(
              b?.create_date || b?.created_at || b?.createdAt || 0,
            ).getTime();
            return dateB - dateA;
          });
          const latestCase = item.latest_case || sortedCases[0];
          const openCount = rawCases.filter(
            (c: any) =>
              c?.status === true || c?.status === '1' || c?.status === 'open',
          ).length;
          const latestDate =
            latestCase?.create_date ||
            latestCase?.created_at ||
            latestCase?.createdAt;

          return (
            <FadeInView delay={Math.min(index * 35, 250)} distance={12}>
              <ScalePressable
                accessibilityRole="button"
                onLongPress={() => {
                  setSelectionMode(true);
                  setSelectedNumbers([contactNum]);
                }}
                delayLongPress={450}
                onPress={() => {
                  if (selectionMode) {
                    setSelectedNumbers((prev) =>
                      prev.includes(contactNum)
                        ? prev.filter((value) => value !== contactNum)
                        : [...prev, contactNum],
                    );
                  } else {
                    onOpenDetails({
                      number: contactNum,
                      name: item.contact?.name || item.name,
                    });
                  }
                }}
                style={styles.card}
              >
                {selectionMode && (
                  <Pressable
                    onPress={() => {
                      const number = String(item.number || item.phone || '');
                      setSelectedNumbers((prev) =>
                        prev.includes(number)
                          ? prev.filter((value) => value !== number)
                          : [...prev, number],
                      );
                    }}
                    style={[
                      styles.selectCircle,
                      {
                        borderColor: theme.border,
                        backgroundColor: selectedNumbers.includes(contactNum)
                          ? theme.emerald
                          : theme.canvas,
                      },
                    ]}
                  >
                    {selectedNumbers.includes(contactNum) && (
                      <Check size={13} color="#FFF" />
                    )}
                  </Pressable>
                )}
                <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
                  <Text
                    style={[styles.avatarText, { color: theme.mintText }]}
                  >
                    {contactName.trim().charAt(0).toUpperCase() || 'C'}
                  </Text>
                </View>

                <View style={styles.cardBody}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.cardTitle, { color: theme.ink, flex: 1 }]}
                    >
                      {contactName}
                    </Text>
                    {latestDate && (
                      <Text style={[styles.timeText, { color: theme.muted }]}>
                        {formatShortDateTime(latestDate)}
                      </Text>
                    )}
                  </View>

                  {latestCase && (
                    <View style={styles.latestCasePreview}>
                      <View style={styles.latestCaseTitleRow}>
                        <Text
                          style={[styles.latestCaseLabel, { color: theme.muted }]}
                        >
                          Latest:
                        </Text>
                        <Text
                          style={[
                            styles.latestCaseName,
                            { color: theme.ink },
                          ]}
                          numberOfLines={1}
                        >
                          {latestCase.name || 'Untitled Case'}
                        </Text>
                      </View>
                      {latestCase.remark ? (
                        <Text
                          style={[
                            styles.latestCaseRemark,
                            { color: theme.muted },
                          ]}
                          numberOfLines={1}
                        >
                          {latestCase.remark}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {openCount > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={[styles.cardMeta, { color: theme.muted }]}
                      >
                        {rawCases.length} case
                        {rawCases.length === 1 ? '' : 's'}
                      </Text>
                      <View
                        style={[
                          styles.unreadBadge,
                          { backgroundColor: theme.emerald },
                        ]}
                      >
                        <Text style={styles.unreadText}>
                          {openCount} open
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <Text style={[styles.arrow, { color: theme.muted }]}>›</Text>
              </ScalePressable>
            </FadeInView>
          );
        }}
      />

      {selectionMode && (
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="Close selected cases"
          onPress={closeSelectedCases}
          disabled={!selectedNumbers.length || bulkCloseLoading}
          style={[
            styles.bulkFab,
            {
              backgroundColor: selectedNumbers.length
                ? '#E11D48'
                : theme.muted,
            },
          ]}
        >
          {bulkCloseLoading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <CheckSquare size={21} color="#FFF" />
              <Text style={styles.bulkFabText}>
                Close {selectedNumbers.length}
              </Text>
            </>
          )}
        </ScalePressable>
      )}

      {!selectionMode && (
        <ScalePressable
          accessibilityRole="button"
          onPress={() => onCreateCase?.()}
          style={[styles.fab, { backgroundColor: theme.emerald }]}
        >
          <Plus size={24} color="#FFF" strokeWidth={2.5} />
        </ScalePressable>
      )}
    </KeyboardAvoidView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchSection: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },
  caseFilterButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseFilterOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  caseFilterModal: {
    width: '100%',
    maxHeight: '72%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  caseFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  caseFilterTitle: { fontSize: 17, fontWeight: '800' },
  caseFilterClose: { fontSize: 26, lineHeight: 26 },
  caseFilterList: { flexGrow: 0 },
  caseFilterOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  caseFilterOptionText: { fontSize: 14, fontWeight: '600' },

  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  count: { flex: 1, fontSize: 12, fontWeight: '800' },
  selectAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 9,
    marginLeft: 8,
  },
  selectAllText: { fontSize: 11, fontWeight: '800' },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 9,
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    paddingTop: 6,
    gap: 10,
  },
  emptyListContent: { flexGrow: 1, paddingHorizontal: 16 },

  card: {
    borderRadius: 17,
    padding: 2,
    marginTop: 6,
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
  cardMeta: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 10,
    marginLeft: 8,
  },
  unreadBadge: {
    borderRadius: 10,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 0,
  },
  unreadText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  latestCasePreview: {
    marginTop: 4,
  },
  latestCaseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  latestCaseLabel: { fontSize: 10, fontWeight: '700' },
  latestCaseName: { flex: 1, fontSize: 11, fontWeight: '700' },
  latestCaseRemark: { fontSize: 10, marginTop: 1 },
  arrow: { fontSize: 24, lineHeight: 26, marginLeft: 4 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  bulkFab: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    minWidth: 126,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 17,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  bulkFabText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
