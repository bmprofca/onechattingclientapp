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
  ArrowLeft,
  Search,
  Plus,
  Clock,
  Calendar,
  Eye,
  Edit2,
  X,
  MessageCircle,
  FileText,
  AlertCircle,
  Phone,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import {
  getOpenCases,
  getCaseList,
  createCase,
  editCase,
  getContactList,
} from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import { ScalePressable, FadeInView, PulseView } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';

// --- Date Formatters matching web OpenCaseList.js ---
const parseServerDate = (value: any): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const formatOpenSince = (value: any): string => {
  if (!value) return '-';
  const created = parseServerDate(value);
  if (!created) return '-';
  const diffMs = Date.now() - created.getTime();
  if (diffMs < 0) return '0m';
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
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

export function OpenCasesScreen({
  projectId,
  session,
  onBack,
  onOpenChat,
}: {
  projectId: string;
  session: ApiSession;
  onBack?: () => void;
  onOpenChat: (contactNumber: string, contactName: string) => void;
}) {
  const theme = useTheme();

  // --- Main List State ---
  const [casesByNumber, setCasesByNumber] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // --- View Cases Modal State ---
  const [showCaseListModal, setShowCaseListModal] = useState(false);
  const [caseModalNumber, setCaseModalNumber] = useState('');
  const [caseModalContact, setCaseModalContact] = useState<any>(null);
  const [caseList, setCaseList] = useState<any[]>([]);
  const [caseListLoading, setCaseListLoading] = useState(false);
  const [caseListError, setCaseListError] = useState('');
  const [caseListSearch, setCaseListSearch] = useState('');
  const [caseListStatusFilter, setCaseListStatusFilter] = useState<'' | 'open' | 'closed'>('');

  // --- Create Case Modal State ---
  const [showCaseCreateModal, setShowCaseCreateModal] = useState(false);
  const [caseCreateSelectedContact, setCaseCreateSelectedContact] = useState<any>(null);
  const [caseCreateName, setCaseCreateName] = useState('');
  const [caseCreateRemark, setCaseCreateRemark] = useState('');
  const [caseCreateStatus, setCaseCreateStatus] = useState<'open' | 'closed'>('open');
  const [caseCreateLoading, setCaseCreateLoading] = useState(false);
  const [caseCreateError, setCaseCreateError] = useState('');
  const [manualNumberInput, setManualNumberInput] = useState(false);
  const [manualNumber, setManualNumber] = useState('');

  // Contact picker inside create modal
  const [createContacts, setCreateContacts] = useState<any[]>([]);
  const [createContactsLoading, setCreateContactsLoading] = useState(false);
  const [createContactsQuery, setCreateContactsQuery] = useState('');

  // --- Edit Case Modal State ---
  const [showCaseEditModal, setShowCaseEditModal] = useState(false);
  const [caseEditRow, setCaseEditRow] = useState<any>(null);
  const [caseEditName, setCaseEditName] = useState('');
  const [caseEditRemark, setCaseEditRemark] = useState('');
  const [caseEditStatus, setCaseEditStatus] = useState<'open' | 'closed'>('open');
  const [caseEditLoading, setCaseEditLoading] = useState(false);
  const [caseEditError, setCaseEditError] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch main open cases list
  const fetchOpenCases = useCallback(async () => {
    if (!projectId || !session?.token) return;
    setLoading(true);
    setError('');
    try {
      const res = await getOpenCases(session, projectId, debouncedSearch);
      if (res?.error) {
        setError(typeof res.error === 'string' ? res.error : res.msg || 'Failed to get open cases');
        setCasesByNumber([]);
        setTotal(0);
        return;
      }
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.list) ? res.list : [];
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
  }, [projectId, session.token, session.username, debouncedSearch]);

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

  // --- Fetch Cases for a Number (Modal) ---
  const fetchCaseListForNumber = useCallback(
    async (number: string, searchQuery?: string, statusFilter?: string) => {
      if (!projectId || !session?.token || !number) return;
      setCaseListLoading(true);
      setCaseListError('');
      try {
        const res = await getCaseList(
          session,
          projectId,
          number,
          searchQuery !== undefined ? searchQuery : caseListSearch,
          statusFilter !== undefined ? statusFilter : caseListStatusFilter,
        );
        if (res?.error) {
          setCaseListError(typeof res.error === 'string' ? res.error : res.message || 'Failed to load cases');
          setCaseList([]);
          return;
        }
        const list = res?.data ?? res?.list ?? [];
        setCaseList(Array.isArray(list) ? list : []);
      } catch (err: any) {
        setCaseListError(err?.message || 'Failed to load case list');
        setCaseList([]);
      } finally {
        setCaseListLoading(false);
      }
    },
    [projectId, session.token, session.username, caseListSearch, caseListStatusFilter],
  );

  const openCaseModal = (item: any) => {
    const num = item.number || item.phone || '';
    const contact = item.contact || null;
    setCaseModalNumber(num);
    setCaseModalContact(contact);
    setCaseList([]);
    setCaseListError('');
    setCaseListSearch('');
    setCaseListStatusFilter('');
    setShowCaseListModal(true);
    fetchCaseListForNumber(num, '', '');
  };

  // --- Contact Picker Search for Create Case ---
  const searchContacts = useCallback(
    async (query: string) => {
      if (!projectId || !session?.token) return;
      setCreateContactsLoading(true);
      try {
        const res = await getContactList(session, projectId, 1, 15, query);
        const list = res?.data || res?.list || [];
        setCreateContacts(
          list.map((c: any) => ({
            id: c.contact_id || c.id,
            name: c.name || c.contact_name,
            number: c.number || c.phone,
            firm_name: c.firm_name,
          })),
        );
      } catch {
        setCreateContacts([]);
      } finally {
        setCreateContactsLoading(false);
      }
    },
    [projectId, session.token, session.username],
  );

  const openCaseCreateModal = () => {
    setCaseCreateSelectedContact(null);
    setCaseCreateName('');
    setCaseCreateRemark('');
    setCaseCreateStatus('open');
    setCaseCreateError('');
    setManualNumberInput(false);
    setManualNumber('');
    setCreateContacts([]);
    setCreateContactsQuery('');
    setShowCaseCreateModal(true);
    searchContacts('');
  };

  const handleCreateCase = async () => {
    const num = manualNumberInput
      ? manualNumber.trim()
      : caseCreateSelectedContact?.number;
    if (!num) {
      setCaseCreateError('Please select or enter a contact number');
      return;
    }
    const name = caseCreateName.trim();
    if (!name) {
      setCaseCreateError('Case name is required');
      return;
    }

    setCaseCreateLoading(true);
    setCaseCreateError('');
    try {
      const res = await createCase(session, {
        project_id: projectId,
        number: num,
        name,
        remark: caseCreateRemark.trim(),
        status: caseCreateStatus,
      });

      if (res?.error) {
        setCaseCreateError(typeof res.error === 'string' ? res.error : res.msg || 'Failed to create case');
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Case Created',
        text2: 'New case created successfully',
      });
      setShowCaseCreateModal(false);
      fetchOpenCases();
    } catch (err: any) {
      setCaseCreateError(err?.message || 'Failed to create case');
    } finally {
      setCaseCreateLoading(false);
    }
  };

  // --- Edit Case ---
  const openEditCase = (row: any) => {
    setCaseEditRow(row);
    setCaseEditName(row?.name || '');
    setCaseEditRemark(row?.remark || '');
    setCaseEditStatus(row?.status === true || row?.status === '1' || row?.status === 'open' ? 'open' : 'closed');
    setCaseEditError('');
    setShowCaseEditModal(true);
  };

  const handleSaveEditCase = async () => {
    const caseId = caseEditRow?.case_id || caseEditRow?.id;
    if (!caseId) return;
    const name = caseEditName.trim();
    if (!name) {
      setCaseEditError('Case name is required');
      return;
    }

    setCaseEditLoading(true);
    setCaseEditError('');
    try {
      const res = await editCase(session, {
        project_id: projectId,
        case_id: caseId,
        name,
        remark: caseEditRemark.trim(),
        status: caseEditStatus,
      });

      if (res?.error) {
        setCaseEditError(typeof res.error === 'string' ? res.error : res.msg || 'Failed to update case');
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Case Updated',
        text2: 'Case updated successfully',
      });
      setShowCaseEditModal(false);
      // Refresh modal list
      if (caseModalNumber) {
        fetchCaseListForNumber(caseModalNumber);
      }
      // Refresh main open cases
      fetchOpenCases();
    } catch (err: any) {
      setCaseEditError(err?.message || 'Failed to update case');
    } finally {
      setCaseEditLoading(false);
    }
  };

  return (
    <KeyboardAvoidView style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          {onBack && (
            <ScalePressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
              <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
            </ScalePressable>
          )}
          <View>
            <Text style={[styles.headerTitle, { color: theme.ink }]}>Open Cases</Text>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
              List of numbers with at least one open case
            </Text>
          </View>
        </View>

        <ScalePressable
          accessibilityRole="button"
          onPress={openCaseCreateModal}
          style={[styles.createBtn, { backgroundColor: theme.emerald }]}
        >
          <Plus size={16} color="#FFF" strokeWidth={3} />
          <Text style={styles.createBtnText}>Create Case</Text>
        </ScalePressable>
      </View>

      {/* Counter Pill Banner */}
      <View style={styles.counterBannerRow}>
        <View style={[styles.counterPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <PulseView duration={1600} maxScale={1.2} minScale={0.8}>
            <View style={[styles.counterDot, { backgroundColor: theme.emerald }]} />
          </PulseView>
          <Text style={[styles.counterText, { color: theme.muted }]}>
            Total Numbers with Open Cases:{' '}
            <Text style={{ fontWeight: '800', color: theme.ink }}>{total}</Text>
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Search size={18} color={theme.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.ink }]}
            placeholder="Search by number, contact, case..."
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
      </View>

      {/* Main List */}
      <FlatList
        data={casesByNumber}
        keyExtractor={(item, index) => String(item.number || item.phone || index) + '-' + index}
        contentContainerStyle={casesByNumber.length ? styles.listContent : styles.emptyListContent}
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
            empty={!loading && !error}
            emptyTitle="No open cases found"
            emptyCopy="There are no active open cases at the moment."
            onRetry={fetchOpenCases}
          />
        }
        renderItem={({ item, index }) => {
          const contact = item.contact || {};
          const contactNum = String(item.number || contact.number || item.phone || '');
          const contactName = String(
            contact.name || contact.firm_name || item.name || item.contact_name || contactNum,
          );
          const rawCases = Array.isArray(item.cases)
            ? item.cases
            : Array.isArray(item.case_list)
            ? item.case_list
            : item.case
            ? [item.case]
            : [];

          // Sort open cases first
          const sortedCases = [...rawCases].sort((a, b) => {
            const aOpen = a.status === true || a.status === '1' || a.status === 'open';
            const bOpen = b.status === true || b.status === '1' || b.status === 'open';
            if (aOpen && !bOpen) return -1;
            if (!aOpen && bOpen) return 1;
            return 0;
          });

          return (
            <FadeInView delay={Math.min(index * 40, 240)} distance={8}>
              <View style={[styles.numberCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {/* Number Card Header */}
                <View style={styles.numberCardHeader}>
                  <View style={[styles.contactAvatar, { backgroundColor: theme.mint }]}>
                    <Text style={[styles.contactAvatarText, { color: theme.mintText }]}>
                      {contactName.trim().charAt(0).toUpperCase() || 'C'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={[styles.contactName, { color: theme.ink }]}>
                      {contactName}
                    </Text>
                    <Text style={[styles.contactPhone, { color: theme.muted }]}>
                      {contactNum}
                    </Text>
                  </View>
                  <ScalePressable
                    onPress={() => onOpenChat(contactNum, contactName)}
                    style={[styles.chatActionBtn, { backgroundColor: theme.mint }]}
                    hitSlop={6}
                  >
                    <MessageCircle size={17} color={theme.emerald} strokeWidth={2.2} />
                  </ScalePressable>
                </View>

                {/* Divider */}
                <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                {/* Mini Cases Display */}
                {sortedCases.length === 0 ? (
                  <Text style={[styles.noCasesText, { color: theme.muted }]}>No case details available</Text>
                ) : (
                  <View style={styles.miniCasesGrid}>
                    {sortedCases.slice(0, 3).map((c: any, cIdx: number) => {
                      const caseDate = c?.create_date || c?.created_at || c?.createdAt || c?.created_date;
                      const isOpen = c?.status === true || c?.status === '1' || c?.status === 'open';

                      return (
                        <View
                          key={c?.case_id || c?.id || `${contactNum}-${cIdx}`}
                          style={[
                            styles.miniCaseCard,
                            {
                              backgroundColor: theme.isDark ? '#0D2B22' : '#F4FBF7',
                              borderColor: theme.isDark ? '#1C4A3C' : '#D1F2E0',
                            },
                          ]}
                        >
                          <View style={styles.miniCaseHeader}>
                            <View style={[styles.miniCaseIcon, { backgroundColor: theme.emerald }]}>
                              <FileText size={13} color="#FFF" />
                            </View>
                            <Text numberOfLines={1} style={[styles.miniCaseTitle, { color: theme.ink }]}>
                              {c?.name || 'Case'}
                            </Text>
                          </View>

                          <View style={styles.miniCaseMetaRow}>
                            <View
                              style={[
                                styles.openSincePill,
                                {
                                  backgroundColor: isOpen ? '#FEF3C7' : '#DCFCE7',
                                },
                              ]}
                            >
                              <Clock size={11} color={isOpen ? '#D97706' : '#16A34A'} />
                              <Text
                                style={[
                                  styles.openSinceText,
                                  { color: isOpen ? '#B45309' : '#15803D' },
                                ]}
                              >
                                {isOpen ? `Open ${formatOpenSince(caseDate)}` : 'Closed'}
                              </Text>
                            </View>
                          </View>

                          {caseDate && (
                            <View style={styles.miniCaseDateRow}>
                              <Calendar size={11} color={theme.muted} />
                              <Text style={[styles.miniCaseDateText, { color: theme.muted }]}>
                                {formatShortDateTime(caseDate)}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Footer Action */}
                <View style={styles.numberCardFooter}>
                  <ScalePressable
                    onPress={() => openCaseModal(item)}
                    style={[
                      styles.viewCasesBtn,
                      {
                        backgroundColor: theme.isDark ? '#103B35' : '#E7F8F2',
                        borderColor: theme.isDark ? '#1C4A3C' : '#D1F2E0',
                      },
                    ]}
                  >
                    <Eye size={14} color={theme.emerald} strokeWidth={2.2} />
                    <Text style={[styles.viewCasesBtnText, { color: theme.emerald }]}>
                      View All Cases ({rawCases.length})
                    </Text>
                  </ScalePressable>
                </View>
              </View>
            </FadeInView>
          );
        }}
      />

      {/* =========================================================================
          MODAL 1: VIEW ALL CASES FOR A NUMBER
          ========================================================================= */}
      <Modal
        visible={showCaseListModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCaseListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, maxHeight: '88%' }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FileText size={18} color={theme.emerald} />
                  <Text style={[styles.modalTitle, { color: theme.ink }]}>Case List</Text>
                </View>
                <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
                  Contact: <Text style={{ color: theme.ink, fontWeight: '700' }}>{caseModalContact?.name || caseModalNumber}</Text> ({caseModalNumber})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ScalePressable
                  onPress={() => {
                    setShowCaseListModal(false);
                    onOpenChat(caseModalNumber, caseModalContact?.name || caseModalNumber);
                  }}
                  style={[styles.chatHeaderBtn, { backgroundColor: theme.mint }]}
                >
                  <MessageCircle size={16} color={theme.emerald} />
                  <Text style={[styles.chatHeaderBtnText, { color: theme.emerald }]}>Chat</Text>
                </ScalePressable>
                <Pressable hitSlop={8} onPress={() => setShowCaseListModal(false)}>
                  <X size={22} color={theme.muted} />
                </Pressable>
              </View>
            </View>

            {/* Modal Search & Filter */}
            <View style={styles.modalFiltersRow}>
              <View style={[styles.modalSearchContainer, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                <Search size={15} color={theme.muted} />
                <TextInput
                  value={caseListSearch}
                  onChangeText={(val) => {
                    setCaseListSearch(val);
                    fetchCaseListForNumber(caseModalNumber, val, caseListStatusFilter);
                  }}
                  placeholder="Filter cases..."
                  placeholderTextColor={theme.muted}
                  style={[styles.modalSearchInput, { color: theme.ink }]}
                />
              </View>

              {/* Status Filter Chips */}
              <View style={styles.filterChipsRow}>
                {(['', 'open', 'closed'] as const).map((st) => {
                  const active = caseListStatusFilter === st;
                  const label = st === '' ? 'All' : st === 'open' ? 'Open' : 'Closed';
                  return (
                    <Pressable
                      key={st}
                      onPress={() => {
                        setCaseListStatusFilter(st);
                        fetchCaseListForNumber(caseModalNumber, caseListSearch, st);
                      }}
                      style={[
                        styles.filterChip,
                        { borderColor: theme.border, backgroundColor: theme.canvas },
                        active && { backgroundColor: theme.emerald, borderColor: theme.emerald },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: active ? '#FFF' : theme.muted },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Cases List Inside Modal */}
            {caseListLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.emerald} />
              </View>
            ) : caseListError ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: theme.danger }}>{caseListError}</Text>
              </View>
            ) : caseList.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={[styles.emptyTitle, { color: theme.ink }]}>No cases found</Text>
                <Text style={[styles.emptyCopy, { color: theme.muted }]}>
                  No cases match the selected filter.
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
                {caseList.map((row: any, idx: number) => {
                  const isOpen = row.status === true || row.status === '1' || row.status === 'open';
                  const createDate = row.created_at || row.create_date || row.createdAt || row.created_date;

                  return (
                    <View
                      key={row.id || row.case_id || idx}
                      style={[styles.modalCaseCard, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                    >
                      <View style={styles.modalCaseCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalCaseCardTitle, { color: theme.ink }]}>
                            {row.name || 'Untitled Case'}
                          </Text>
                          <Text style={[styles.modalCaseDate, { color: theme.muted }]}>
                            Created: {formatDateOnly(createDate)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={[
                              styles.statusPill,
                              { backgroundColor: isOpen ? '#FEF3C7' : '#DCFCE7' },
                            ]}
                          >
                            <Text style={[styles.statusPillText, { color: isOpen ? '#B45309' : '#15803D' }]}>
                              {isOpen ? 'OPEN' : 'CLOSED'}
                            </Text>
                          </View>
                          <ScalePressable
                            onPress={() => openEditCase(row)}
                            style={[styles.editCaseBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                            hitSlop={6}
                          >
                            <Edit2 size={13} color={theme.emerald} />
                          </ScalePressable>
                        </View>
                      </View>

                      {/* Remark */}
                      {row.remark ? (
                        <View style={[styles.remarkBox, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.remarkText, { color: theme.ink }]}>
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
        </View>
      </Modal>

      {/* =========================================================================
          MODAL 2: CREATE CASE (CONTACT PICKER + DETAILS)
          ========================================================================= */}
      <Modal
        visible={showCaseCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCaseCreateModal(false)}
      >
        <KeyboardAvoidView style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, maxHeight: '92%' }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.ink }]}>Create Case</Text>
                <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
                  Select a contact and enter case details
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setShowCaseCreateModal(false)}>
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} keyboardShouldPersistTaps="handled">
              {caseCreateError ? (
                <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={[styles.errorBoxText, { color: '#B91C1C' }]}>{caseCreateError}</Text>
                </View>
              ) : null}

              {/* Step 1: Contact Selection */}
              <View>
                <Text style={[styles.formLabel, { color: theme.muted }]}>CONTACT *</Text>
                {caseCreateSelectedContact && !manualNumberInput ? (
                  <View style={[styles.selectedContactCard, { backgroundColor: theme.canvas, borderColor: theme.emerald }]}>
                    <View style={[styles.contactAvatar, { backgroundColor: theme.mint }]}>
                      <Text style={[styles.contactAvatarText, { color: theme.mintText }]}>
                        {caseCreateSelectedContact.name?.charAt(0).toUpperCase() || 'C'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.contactName, { color: theme.ink }]}>
                        {caseCreateSelectedContact.name || 'Contact'}
                      </Text>
                      <Text style={[styles.contactPhone, { color: theme.muted }]}>
                        {caseCreateSelectedContact.number}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setCaseCreateSelectedContact(null)}
                      style={[styles.changeContactBtn, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.changeContactBtnText, { color: theme.emerald }]}>Change</Text>
                    </Pressable>
                  </View>
                ) : manualNumberInput ? (
                  <View style={{ gap: 10 }}>
                    <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                      <Phone size={16} color={theme.muted} />
                      <TextInput
                        value={manualNumber}
                        onChangeText={setManualNumber}
                        keyboardType="phone-pad"
                        placeholder="Phone number e.g. +919876543210"
                        placeholderTextColor={theme.muted}
                        style={[styles.input, { color: theme.ink }]}
                      />
                    </View>
                    <Pressable
                      onPress={() => setManualNumberInput(false)}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <Text style={{ fontSize: 12, color: theme.emerald, fontWeight: '700' }}>
                        ← Select from contacts list
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                      <Search size={16} color={theme.muted} />
                      <TextInput
                        value={createContactsQuery}
                        onChangeText={(q) => {
                          setCreateContactsQuery(q);
                          searchContacts(q);
                        }}
                        placeholder="Search contact name or number..."
                        placeholderTextColor={theme.muted}
                        style={[styles.input, { color: theme.ink }]}
                      />
                    </View>

                    {createContactsLoading ? (
                      <ActivityIndicator color={theme.emerald} style={{ padding: 12 }} />
                    ) : (
                      <ScrollView style={styles.contactsPickerList} nestedScrollEnabled>
                        {createContacts.map((c) => (
                          <Pressable
                            key={c.id || c.number}
                            onPress={() => setCaseCreateSelectedContact(c)}
                            style={[styles.contactPickerItem, { borderBottomColor: theme.border }]}
                          >
                            <View style={[styles.contactPickerAvatar, { backgroundColor: theme.mint }]}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.mintText }}>
                                {c.name?.charAt(0).toUpperCase() || 'C'}
                              </Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.contactPickerName, { color: theme.ink }]}>
                                {c.name || 'Contact'}
                              </Text>
                              <Text style={[styles.contactPickerPhone, { color: theme.muted }]}>
                                {c.number} {c.firm_name ? `· ${c.firm_name}` : ''}
                              </Text>
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}

                    <Pressable
                      onPress={() => setManualNumberInput(true)}
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    >
                      <Text style={{ fontSize: 12, color: theme.emerald, fontWeight: '700' }}>
                        + Enter phone number manually
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Step 2: Case Details */}
              <View>
                <Text style={[styles.formLabel, { color: theme.muted }]}>CASE NAME *</Text>
                <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <FileText size={16} color={theme.muted} />
                  <TextInput
                    value={caseCreateName}
                    onChangeText={setCaseCreateName}
                    placeholder="e.g. Order Inquiry / Support Ticket"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.formLabel, { color: theme.muted }]}>REMARK</Text>
                <View style={[styles.inputRow, styles.textAreaRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <TextInput
                    value={caseCreateRemark}
                    onChangeText={setCaseCreateRemark}
                    multiline
                    numberOfLines={3}
                    placeholder="Details or notes about this case..."
                    placeholderTextColor={theme.muted}
                    style={[styles.input, styles.textArea, { color: theme.ink }]}
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.formLabel, { color: theme.muted }]}>INITIAL STATUS</Text>
                <View style={styles.statusToggleRow}>
                  <Pressable
                    onPress={() => setCaseCreateStatus('open')}
                    style={[
                      styles.statusToggleBtn,
                      { borderColor: theme.border, backgroundColor: theme.canvas },
                      caseCreateStatus === 'open' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        { color: caseCreateStatus === 'open' ? '#FFF' : theme.muted },
                      ]}
                    >
                      Open
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setCaseCreateStatus('closed')}
                    style={[
                      styles.statusToggleBtn,
                      { borderColor: theme.border, backgroundColor: theme.canvas },
                      caseCreateStatus === 'closed' && { backgroundColor: '#10B981', borderColor: '#10B981' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        { color: caseCreateStatus === 'closed' ? '#FFF' : theme.muted },
                      ]}
                    >
                      Closed
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Submit Button */}
              <ScalePressable
                onPress={handleCreateCase}
                disabled={caseCreateLoading}
                style={[styles.submitButton, { backgroundColor: theme.emerald }]}
              >
                {caseCreateLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Case</Text>
                )}
              </ScalePressable>
            </ScrollView>
          </View>
        </KeyboardAvoidView>
      </Modal>

      {/* =========================================================================
          MODAL 3: EDIT CASE
          ========================================================================= */}
      <Modal
        visible={showCaseEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCaseEditModal(false)}
      >
        <KeyboardAvoidView style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.ink }]}>Edit Case</Text>
              <Pressable hitSlop={8} onPress={() => setShowCaseEditModal(false)}>
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>

            <View style={{ padding: 18, gap: 14 }}>
              {caseEditError ? (
                <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={[styles.errorBoxText, { color: '#B91C1C' }]}>{caseEditError}</Text>
                </View>
              ) : null}

              <View>
                <Text style={[styles.formLabel, { color: theme.muted }]}>CASE NAME *</Text>
                <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <FileText size={16} color={theme.muted} />
                  <TextInput
                    value={caseEditName}
                    onChangeText={setCaseEditName}
                    placeholder="Case name"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.formLabel, { color: theme.muted }]}>REMARK</Text>
                <View style={[styles.inputRow, styles.textAreaRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <TextInput
                    value={caseEditRemark}
                    onChangeText={setCaseEditRemark}
                    multiline
                    numberOfLines={3}
                    placeholder="Remark"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, styles.textArea, { color: theme.ink }]}
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.formLabel, { color: theme.muted }]}>STATUS</Text>
                <View style={styles.statusToggleRow}>
                  <Pressable
                    onPress={() => setCaseEditStatus('open')}
                    style={[
                      styles.statusToggleBtn,
                      { borderColor: theme.border, backgroundColor: theme.canvas },
                      caseEditStatus === 'open' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        { color: caseEditStatus === 'open' ? '#FFF' : theme.muted },
                      ]}
                    >
                      Open
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setCaseEditStatus('closed')}
                    style={[
                      styles.statusToggleBtn,
                      { borderColor: theme.border, backgroundColor: theme.canvas },
                      caseEditStatus === 'closed' && { backgroundColor: '#10B981', borderColor: '#10B981' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        { color: caseEditStatus === 'closed' ? '#FFF' : theme.muted },
                      ]}
                    >
                      Closed
                    </Text>
                  </Pressable>
                </View>
              </View>

              <ScalePressable
                onPress={handleSaveEditCase}
                disabled={caseEditLoading}
                style={[styles.submitButton, { backgroundColor: theme.emerald }]}
              >
                {caseEditLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Changes</Text>
                )}
              </ScalePressable>
            </View>
          </View>
        </KeyboardAvoidView>
      </Modal>
    </KeyboardAvoidView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginRight: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 11, marginTop: 1 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  createBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },

  // Counter banner
  counterBannerRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    gap: 8,
  },
  counterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  counterText: { fontSize: 12 },

  // Search
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 6 },
  emptyListContent: { flexGrow: 1, paddingHorizontal: 16 },

  // Number card
  numberCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  numberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: { fontSize: 17, fontWeight: '800' },
  contactName: { fontSize: 15, fontWeight: '800' },
  contactPhone: { fontSize: 12, marginTop: 2 },
  chatActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDivider: { height: 1, marginVertical: 12, opacity: 0.6 },
  noCasesText: { fontSize: 12, paddingVertical: 4 },

  // Mini cases grid
  miniCasesGrid: { gap: 8 },
  miniCaseCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  miniCaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniCaseIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCaseTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  miniCaseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  openSincePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  openSinceText: { fontSize: 11, fontWeight: '700' },
  miniCaseDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  miniCaseDateText: { fontSize: 11 },

  // Number card footer
  numberCardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  viewCasesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  viewCasesBtnText: { fontSize: 12, fontWeight: '700' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  chatHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chatHeaderBtnText: { fontSize: 12, fontWeight: '700' },

  modalFiltersRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  modalSearchInput: { flex: 1, fontSize: 13 },
  filterChipsRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },

  modalCaseCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  modalCaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCaseCardTitle: { fontSize: 14, fontWeight: '700' },
  modalCaseDate: { fontSize: 11, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  editCaseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remarkBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
  remarkText: { fontSize: 12, lineHeight: 16 },

  // Form styles
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  textAreaRow: {
    height: 80,
    alignItems: 'flex-start',
  },
  input: { flex: 1, fontSize: 14, height: '100%' },
  textArea: { height: '100%', paddingTop: 10, textAlignVertical: 'top' },

  selectedContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  changeContactBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeContactBtnText: { fontSize: 12, fontWeight: '700' },

  contactsPickerList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  contactPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
  },
  contactPickerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPickerName: { fontSize: 13, fontWeight: '700' },
  contactPickerPhone: { fontSize: 11, marginTop: 1 },

  statusToggleRow: { flexDirection: 'row', gap: 10 },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToggleBtnText: { fontSize: 13, fontWeight: '700' },

  submitButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorBoxText: { fontSize: 12, flex: 1 },

  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyCopy: { fontSize: 13, marginTop: 4, textAlign: 'center' },
});
