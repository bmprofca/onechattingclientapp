import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  ArrowLeft,
  Calendar,
  Heart,
  Mail,
  MapPin,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  User,
  Users,
  X,
  Edit2,
  Check,
  Building,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import {
  ScannedUser,
  getScannedUsers,
  addScannedUser,
  updateScannedUser,
  deleteScannedUser,
  getProjectQRCodes,
  QRCodeItem,
} from '../api/qrcode';
import { useTheme } from '../theme/theme';
import { ScalePressable, FadeInView } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import Toast from 'react-native-toast-message';

const INITIAL_FORM = {
  name: '',
  mobile: '',
  email: '',
  dob: '',
  anniversary: '',
  company: '',
  address: '',
  notes: '',
  tags: '',
  qr_id: '',
};

export function ScannedUsersScreen({
  projectId,
  session,
  onBack,
}: {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [users, setUsers] = useState<ScannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ScannedUser | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (search = searchTerm) => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [usersRes, qrRes] = await Promise.all([
        getScannedUsers(session, projectId, search, 1, 50),
        getProjectQRCodes(session, projectId),
      ]);

      if (usersRes.data) {
        setUsers(usersRes.data);
        setTotalCount(usersRes.pagination?.total ?? usersRes.data.length);
      }
      if (qrRes.qr_codes) {
        setQrCodes(qrRes.qr_codes);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load',
        text2: 'Could not fetch scanned users.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, session, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(searchTerm);
  };

  const handleSearch = () => {
    loadData(searchTerm);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setSelectedUser(null);
    setFormData(INITIAL_FORM);
    setModalVisible(true);
  };

  const openEditModal = (user: ScannedUser) => {
    setIsEditMode(true);
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      mobile: user.mobile || '',
      email: user.email || '',
      dob: user.dob ? user.dob.split('T')[0] : '',
      anniversary: user.anniversary ? user.anniversary.split('T')[0] : '',
      company: user.company || '',
      address: user.address || '',
      notes: user.notes || '',
      tags: user.tags || '',
      qr_id: user.qr_id || '',
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Name is required' });
      return;
    }
    if (!formData.mobile.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Mobile number is required' });
      return;
    }

    try {
      setSubmitting(true);
      if (isEditMode && selectedUser) {
        const res = await updateScannedUser(session, {
          ...formData,
          scan_id: selectedUser.scan_id,
          project_id: projectId,
        });
        if (!res.error) {
          Toast.show({ type: 'success', text1: 'Updated', text2: 'User details updated successfully.' });
          setModalVisible(false);
          loadData(searchTerm);
        } else {
          Toast.show({ type: 'error', text1: 'Update Failed', text2: String(res.error) });
        }
      } else {
        const res = await addScannedUser(session, {
          ...formData,
          project_id: projectId,
        });
        if (!res.error) {
          Toast.show({ type: 'success', text1: 'User Added', text2: 'Scanned user recorded successfully.' });
          setModalVisible(false);
          loadData(searchTerm);
        } else {
          Toast.show({ type: 'error', text1: 'Failed to add', text2: String(res.error) });
        }
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Something went wrong.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (user: ScannedUser) => {
    Alert.alert(
      'Delete Scanned User',
      `Are you sure you want to remove ${user.name} (${user.mobile})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteScannedUser(session, user.scan_id, projectId);
              if (!res.error) {
                Toast.show({ type: 'success', text1: 'Deleted', text2: 'User removed.' });
                loadData(searchTerm);
              } else {
                Toast.show({ type: 'error', text1: 'Error', text2: String(res.error) });
              }
            } catch (e) {
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete user.' });
            }
          },
        },
      ],
    );
  };

  const renderUserCard = ({ item, index }: { item: ScannedUser; index: number }) => {
    const initials = (item.name || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <FadeInView delay={index * 30} distance={8}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
              <Text style={[styles.avatarText, { color: theme.emerald }]}>{initials}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.name, { color: theme.ink }]}>{item.name || 'Unnamed'}</Text>
              <Text style={[styles.mobile, { color: theme.muted }]}>{item.mobile}</Text>
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => openEditModal(item)}
                style={[styles.miniBtn, { backgroundColor: theme.canvas }]}
                hitSlop={6}
              >
                <Edit2 size={15} color={theme.ink} />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item)}
                style={[styles.miniBtn, { backgroundColor: theme.isDark ? '#3D1E1E' : '#FEE2E2' }]}
                hitSlop={6}
              >
                <Trash2 size={15} color="#EF4444" />
              </Pressable>
            </View>
          </View>

          {/* Contact & Company details */}
          <View style={styles.cardDetails}>
            {!!item.email && (
              <View style={styles.detailRow}>
                <Mail size={13} color={theme.muted} />
                <Text style={[styles.detailText, { color: theme.muted }]}>{item.email}</Text>
              </View>
            )}

            {!!item.company && (
              <View style={styles.detailRow}>
                <Building size={13} color={theme.muted} />
                <Text style={[styles.detailText, { color: theme.muted }]}>{item.company}</Text>
              </View>
            )}

            {/* Special Dates */}
            {(!!item.dob || !!item.anniversary) && (
              <View style={styles.datesRow}>
                {!!item.dob && (
                  <View style={[styles.pill, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                    <Calendar size={12} color={theme.emerald} />
                    <Text style={[styles.pillText, { color: theme.ink }]}>DOB: {item.dob}</Text>
                  </View>
                )}
                {!!item.anniversary && (
                  <View style={[styles.pill, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                    <Heart size={12} color="#EC4899" />
                    <Text style={[styles.pillText, { color: theme.ink }]}>Anniv: {item.anniversary}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Address */}
            {!!item.address && (
              <View style={styles.detailRow}>
                <MapPin size={13} color={theme.muted} />
                <Text style={[styles.detailText, { color: theme.muted }]} numberOfLines={2}>
                  {item.address}
                </Text>
              </View>
            )}

            {/* QR source & tags */}
            <View style={styles.badgeRow}>
              {!!item.qr_label && (
                <View style={[styles.qrBadge, { backgroundColor: theme.mint }]}>
                  <QrCode size={11} color={theme.emerald} />
                  <Text style={[styles.qrBadgeText, { color: theme.emerald }]}>{item.qr_label}</Text>
                </View>
              )}

              {!!item.tags &&
                item.tags.split(',').map((t, idx) => (
                  <View key={idx} style={[styles.tagBadge, { backgroundColor: theme.canvas }]}>
                    <Tag size={10} color={theme.muted} />
                    <Text style={[styles.tagText, { color: theme.muted }]}>{t.trim()}</Text>
                  </View>
                ))}
            </View>

            {/* Notes */}
            {!!item.notes && (
              <Text style={[styles.notesText, { color: theme.muted }]} numberOfLines={2}>
                Note: {item.notes}
              </Text>
            )}
          </View>
        </View>
      </FadeInView>
    );
  };

  return (
    <KeyboardAvoidView style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>Scanned Users</Text>
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>{totalCount} captured profiles</Text>
        </View>
        <View style={styles.headerRightActions}>
          <Pressable onPress={openAddModal} style={[styles.addBtn, { backgroundColor: theme.emerald }]} hitSlop={6}>
            <Plus size={18} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* Search & Stats Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchInputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Search size={16} color={theme.muted} />
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            placeholder="Search name, phone, tags..."
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.ink }]}
          />
          {!!searchTerm && (
            <Pressable
              onPress={() => {
                setSearchTerm('');
                loadData('');
              }}
              hitSlop={6}
            >
              <X size={16} color={theme.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.emerald} />
          <Text style={[styles.loadingText, { color: theme.muted }]}>Loading scanned users...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item, index) => String(item.scan_id || item.id || index) + '-' + index}
          renderItem={renderUserCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.emerald} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.mint }]}>
                <Users size={32} color={theme.emerald} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.ink }]}>No Scanned Users Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
                {searchTerm
                  ? 'No contacts matched your search query.'
                  : 'Customers who scan your QR codes or whom you manually record will appear here.'}
              </Text>
              <ScalePressable
                onPress={openAddModal}
                style={[styles.emptyAddBtn, { backgroundColor: theme.emerald }]}
              >
                <Plus size={16} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Add First User</Text>
              </ScalePressable>
            </View>
          }
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidView style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.ink }]}>
                {isEditMode ? 'Edit Scanned User' : 'Add Scanned User'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.ink }]}>Full Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor={theme.muted}
                style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
              />

              <Text style={[styles.inputLabel, { color: theme.ink }]}>Mobile Number *</Text>
              <TextInput
                value={formData.mobile}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, mobile: text }))}
                placeholder="e.g. 919876543210"
                keyboardType="phone-pad"
                placeholderTextColor={theme.muted}
                style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
              />

              <Text style={[styles.inputLabel, { color: theme.ink }]}>Email Address</Text>
              <TextInput
                value={formData.email}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, email: text }))}
                placeholder="e.g. rahul@example.com"
                keyboardType="email-address"
                placeholderTextColor={theme.muted}
                style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
              />

              <Text style={[styles.inputLabel, { color: theme.ink }]}>Company / Firm</Text>
              <TextInput
                value={formData.company}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, company: text }))}
                placeholder="e.g. Acme Corp"
                placeholderTextColor={theme.muted}
                style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
              />

              <View style={styles.formRow}>
                <View style={styles.halfCol}>
                  <Text style={[styles.inputLabel, { color: theme.ink }]}>DOB (YYYY-MM-DD)</Text>
                  <TextInput
                    value={formData.dob}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, dob: text }))}
                    placeholder="1995-05-15"
                    placeholderTextColor={theme.muted}
                    style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={[styles.inputLabel, { color: theme.ink }]}>Anniversary</Text>
                  <TextInput
                    value={formData.anniversary}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, anniversary: text }))}
                    placeholder="2020-11-20"
                    placeholderTextColor={theme.muted}
                    style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: theme.ink }]}>Tags (Comma separated)</Text>
              <TextInput
                value={formData.tags}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, tags: text }))}
                placeholder="VIP, Retail, Customer"
                placeholderTextColor={theme.muted}
                style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
              />

              <Text style={[styles.inputLabel, { color: theme.ink }]}>Address</Text>
              <TextInput
                value={formData.address}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, address: text }))}
                placeholder="Street, City, Pincode"
                placeholderTextColor={theme.muted}
                style={[styles.modalInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
              />

              <Text style={[styles.inputLabel, { color: theme.ink }]}>Notes / Remarks</Text>
              <TextInput
                value={formData.notes}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
                placeholder="Customer preferences, discussion notes..."
                multiline
                numberOfLines={3}
                placeholderTextColor={theme.muted}
                style={[
                  styles.modalInput,
                  styles.textArea,
                  { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink },
                ]}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[styles.cancelBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: theme.muted }]}>Cancel</Text>
              </Pressable>
              <ScalePressable
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.saveBtn, { backgroundColor: theme.emerald }]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFF" />
                    <Text style={styles.saveBtnText}>{isEditMode ? 'Update' : 'Save'}</Text>
                  </>
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
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitleGroup: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
  },
  mobile: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetails: {
    marginTop: 10,
    gap: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  qrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  qrBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalForm: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCol: {
    flex: 1,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingVertical: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
