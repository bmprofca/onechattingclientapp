import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import Toast from '../ui/toast';
import {
  Search,
  Plus,
  Check,
  CheckSquare,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import {
  getOpenCases,
  editCase,
  bulkCloseCases,
} from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme, radii, space, type, cardShadow } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import { ScalePressable, FadeInView } from '../components/animations';
import { useKeyboardContext } from '../contexts/KeyboardContext';
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

/** Presentation-only: how long ago a case was opened, bucketed for tinting. */
const getAgeInfo = (
  value: any,
): { label: string; tone: 'fresh' | 'ageing' | 'old' } | null => {
  const d = parseServerDate(value);
  if (!d) return null;
  const mins = Math.max(0, (Date.now() - d.getTime()) / 60000);
  const label =
    mins < 60
      ? `${Math.max(1, Math.round(mins))}m`
      : mins < 1440
      ? `${Math.round(mins / 60)}h`
      : `${Math.round(mins / 1440)}d`;
  const tone = mins < 1440 ? 'fresh' : mins < 4320 ? 'ageing' : 'old';
  return { label, tone };
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
  const { isKeyboardVisible, keyboardHeightAnim } = useKeyboardContext();

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

  const allSelected =
    casesByNumber.length > 0 && selectedNumbers.length === casesByNumber.length;
  const filterOptions = [
    { label: 'All', value: '' },
    ...(Array.isArray(defaultCaseNames) ? defaultCaseNames : []).map(
      (name: string) => ({ label: name, value: name }),
    ),
    { label: 'Others', value: 'others' },
  ];
  const barBg = theme.isDark ? theme.fieldBg : theme.primary;
  const barText = theme.isDark ? theme.ink : theme.onPrimary;
  const barSub = theme.isDark ? theme.muted : theme.primarySoft;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.canvas, paddingBottom: keyboardHeightAnim },
      ]}
    >
      {/* Header: title, actions, search and filters */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.canvas, borderBottomColor: theme.border },
        ]}
      >
        {!isKeyboardVisible && (
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: theme.ink }]}>Cases</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                {total} contact{total === 1 ? '' : 's'} with open cases
              </Text>
            </View>
            {selectionMode ? (
              <Pressable
                accessibilityRole="button"
                onPress={cancelSelection}
                style={[styles.ghostBtn, { borderColor: theme.border }]}
                hitSlop={6}
              >
                <Text style={[styles.ghostBtnText, { color: theme.inkSoft }]}>
                  Cancel
                </Text>
              </Pressable>
            ) : (
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select cases"
                  onPress={() => setSelectionMode(true)}
                  style={[styles.iconBtn, { backgroundColor: theme.fieldBg }]}
                  hitSlop={6}
                >
                  <CheckSquare size={18} color={theme.inkSoft} />
                </Pressable>
                {onCreateCase && (
                  <ScalePressable
                    accessibilityRole="button"
                    accessibilityLabel="New case"
                    onPress={() => onCreateCase?.()}
                    style={[styles.newBtn, { backgroundColor: theme.primary }]}
                  >
                    <Plus size={16} color={theme.onPrimary} strokeWidth={2.6} />
                    <Text style={[styles.newBtnText, { color: theme.onPrimary }]}>
                      New case
                    </Text>
                  </ScalePressable>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.searchRow}>
          <View style={[styles.searchField, { backgroundColor: theme.fieldBg }]}>
            <Search size={18} color={theme.muted} />
            <TextInput
              style={[styles.searchInput, { color: theme.ink }]}
              placeholder="Search by name or phone number"
              placeholderTextColor={theme.placeholder}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setSearch('')}
              >
                <X size={16} color={theme.muted} />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter cases by name"
            onPress={() => setCaseNameFilterOpen(true)}
            style={[
              styles.filterBtn,
              { backgroundColor: caseNameFilter ? theme.mint : theme.fieldBg },
            ]}
            hitSlop={4}
          >
            <Filter
              size={18}
              color={caseNameFilter ? theme.emerald : theme.inkSoft}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chipsRow}
        >
          {filterOptions.map((option) => {
            const active = caseNameFilter === option.value;
            return (
              <Pressable
                key={option.value || 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCaseNameFilter(option.value)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? theme.onPrimary : theme.inkSoft },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {selectionMode && (
          <View style={styles.selectionRow}>
            <Text style={[styles.selectionHint, { color: theme.muted }]}>
              Tap cases to select them
            </Text>
            <Pressable onPress={toggleAllCases} hitSlop={8}>
              <Text style={[styles.linkText, { color: theme.emerald }]}>
                {allSelected ? 'Clear' : 'Select all'}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filter"
                onPress={() => setCaseNameFilterOpen(false)}
                hitSlop={8}
                style={[styles.modalClose, { backgroundColor: theme.fieldBg }]}
              >
                <X size={16} color={theme.inkSoft} />
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
                    { borderBottomColor: theme.divider },
                  ]}
                >
                  <Text
                    style={[
                      styles.caseFilterOptionText,
                      {
                        color:
                          caseNameFilter === option.value
                            ? theme.emerald
                            : theme.ink,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {caseNameFilter === option.value ? (
                    <Check size={17} color={theme.emerald} strokeWidth={2.6} />
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
            refreshing={loading && casesByNumber.length > 0}
            onRefresh={fetchOpenCases}
            tintColor={theme.emerald}
          />
        }
        ListEmptyComponent={
          <LoadState
            loading={loading}
            skeleton="case"
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
          const isSelected = selectedNumbers.includes(contactNum);
          const age = getAgeInfo(latestDate);
          const ageColors = age
            ? age.tone === 'fresh'
              ? { bg: theme.mint, fg: theme.mintText }
              : age.tone === 'ageing'
              ? { bg: theme.warnBg, fg: theme.warning }
              : { bg: theme.dangerBg, fg: theme.danger }
            : null;
          const assigneeName = String(
            latestCase?.assigned_user?.name ||
              item.assigned_user?.name ||
              '',
          ).trim();
          const assigneeInitials = assigneeName
            .split(/\s+/)
            .map((part: string) => part.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const metaParts = [
            contactNum && contactNum !== contactName ? contactNum : '',
            latestDate ? formatShortDateTime(latestDate) : '',
          ].filter(Boolean);

          return (
            <FadeInView delay={Math.min(index * 35, 250)} distance={12}>
              <ScalePressable
                accessibilityRole="button"
                accessibilityState={selectionMode ? { selected: isSelected } : undefined}
                activeScale={0.98}
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
                style={[
                  styles.card,
                  cardShadow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isSelected ? theme.emerald : theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                {selectionMode && (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => {
                      const number = String(item.number || item.phone || '');
                      setSelectedNumbers((prev) =>
                        prev.includes(number)
                          ? prev.filter((value) => value !== number)
                          : [...prev, number],
                      );
                    }}
                    hitSlop={8}
                    style={[
                      styles.checkbox,
                      isSelected
                        ? { backgroundColor: theme.emerald, borderColor: theme.emerald }
                        : { backgroundColor: theme.surface, borderColor: theme.fieldBorder },
                    ]}
                  >
                    {isSelected && (
                      <Check size={14} color={theme.onPrimary} strokeWidth={3} />
                    )}
                  </Pressable>
                )}

                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text
                      numberOfLines={1}
                      style={[styles.cardTitle, { color: theme.ink }]}
                    >
                      {contactName}
                    </Text>
                    {age && ageColors ? (
                      <View style={[styles.ageChip, { backgroundColor: ageColors.bg }]}>
                        <Text style={[styles.ageText, { color: ageColors.fg }]}>
                          {age.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {latestCase ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.caseName, { color: theme.inkSoft }]}
                    >
                      {latestCase.name || 'Untitled Case'}
                    </Text>
                  ) : null}
                  {latestCase?.remark ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.caseRemark, { color: theme.muted }]}
                    >
                      {latestCase.remark}
                    </Text>
                  ) : null}
                  {metaParts.length > 0 && (
                    <Text
                      numberOfLines={1}
                      style={[styles.cardMeta, { color: theme.muted }]}
                    >
                      {metaParts.join(' · ')}
                    </Text>
                  )}

                  {(rawCases.length > 0 || openCount > 0 || !!assigneeName) && (
                    <View
                      style={[styles.cardFooter, { borderTopColor: theme.divider }]}
                    >
                      {assigneeName ? (
                        <View style={styles.assignee}>
                          <View
                            style={[
                              styles.assigneeAvatar,
                              { backgroundColor: theme.infoBg },
                            ]}
                          >
                            <Text
                              style={[styles.assigneeInitials, { color: theme.info }]}
                            >
                              {assigneeInitials}
                            </Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[styles.assigneeName, { color: theme.inkSoft }]}
                          >
                            {assigneeName}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.caseCount, { color: theme.muted }]}>
                          {rawCases.length} case{rawCases.length === 1 ? '' : 's'}
                        </Text>
                      )}
                      {openCount > 0 && (
                        <View style={[styles.openPill, { backgroundColor: theme.mint }]}>
                          <View
                            style={[styles.openDot, { backgroundColor: theme.emerald }]}
                          />
                          <Text style={[styles.openPillText, { color: theme.mintText }]}>
                            {openCount} open
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {!selectionMode && (
                  <ChevronRight size={18} color={theme.muted} style={styles.chevron} />
                )}
              </ScalePressable>
            </FadeInView>
          );
        }}
      />

      {selectionMode && (
        <View style={[styles.bulkBar, { backgroundColor: barBg, shadowColor: theme.shadow }]}>
          <View style={styles.bulkInfo}>
            <Text style={[styles.bulkCount, { color: barText }]}>
              {selectedNumbers.length} selected
            </Text>
            <Text numberOfLines={1} style={[styles.bulkSub, { color: barSub }]}>
              Closes every open case for these contacts
            </Text>
          </View>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Close selected cases"
            onPress={closeSelectedCases}
            disabled={!selectedNumbers.length || bulkCloseLoading}
            style={[
              styles.bulkBtn,
              {
                backgroundColor: theme.accent,
                opacity: selectedNumbers.length ? 1 : 0.5,
              },
            ]}
          >
            {bulkCloseLoading ? (
              <ActivityIndicator color={theme.onAccent} size="small" />
            ) : (
              <>
                <CheckSquare size={16} color={theme.onAccent} strokeWidth={2.4} />
                <Text style={[styles.bulkBtnText, { color: theme.onAccent }]}>
                  Close cases
                </Text>
              </>
            )}
          </ScalePressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    gap: space.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  titleBlock: { flex: 1 },
  title: { ...type.display },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtn: {
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBtnText: { fontSize: 14, fontWeight: '700' },
  ghostBtn: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 14, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 15, paddingVertical: 0 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: { gap: space.xs, paddingRight: space.md },
  chip: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionHint: { fontSize: 13 },
  linkText: { fontSize: 13, fontWeight: '700' },

  caseFilterOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(11,19,36,0.45)',
  },
  caseFilterModal: {
    width: '100%',
    maxHeight: '72%',
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  caseFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  caseFilterTitle: { ...type.heading },
  modalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseFilterList: { flexGrow: 0 },
  caseFilterOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  caseFilterOptionText: { fontSize: 15, fontWeight: '600' },

  listContent: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: 110,
    gap: 10,
  },
  emptyListContent: { flexGrow: 1, paddingHorizontal: space.md },

  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  ageChip: {
    borderRadius: radii.xs,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ageText: { ...type.micro },
  caseName: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  caseRemark: { fontSize: 13, marginTop: 2 },
  cardMeta: { fontSize: 13, marginTop: 4 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  caseCount: { fontSize: 12, fontWeight: '600' },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  assigneeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeInitials: { fontSize: 9, fontWeight: '800' },
  assigneeName: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  openPillText: { fontSize: 11, fontWeight: '700' },
  chevron: { marginLeft: 6, marginTop: 2 },

  bulkBar: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    borderRadius: radii.lg,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    elevation: 8,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  bulkInfo: { flex: 1 },
  bulkCount: { fontSize: 15, fontWeight: '700' },
  bulkSub: { fontSize: 12, marginTop: 1 },
  bulkBtn: {
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 120,
  },
  bulkBtnText: { fontSize: 14, fontWeight: '700' },
});
