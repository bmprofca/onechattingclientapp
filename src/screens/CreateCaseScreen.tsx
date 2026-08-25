import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
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
  X,
  FileText,
  AlertCircle,
  Phone,
  Check,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { createCase, getContactList } from '../api/workspace';
import { useTheme } from '../theme/theme';
import { ScalePressable, SlideUpModal } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import { loadCaseNames, saveCustomCaseName } from '../services/caseNames';

function CaseNameSelect({ value, options, onChange, onCreateNew, theme }: any) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}
      >
        <FileText size={16} color={theme.muted} />
        <Text style={[styles.input, { color: value ? theme.ink : theme.muted }]} numberOfLines={1}>
          {value || 'Select a case name'}
        </Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.namePickerOverlay} onPress={() => setVisible(false)}>
          <View style={[styles.namePicker, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.namePickerTitle, { color: theme.ink }]}>Select case name</Text>
            <ScrollView>
              {options.map((option: string) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    onChange(option);
                    setVisible(false);
                  }}
                  style={styles.namePickerOption}
                >
                  {option === value ? <Check size={16} color={theme.emerald} /> : <View style={{ width: 16 }} />}
                  <Text style={[styles.namePickerOptionText, { color: theme.ink }]}>{option}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setVisible(false);
                  onCreateNew();
                }}
                style={[styles.namePickerOption, { borderTopWidth: 1, borderTopColor: theme.border }]}
              >
                <Plus size={16} color={theme.emerald} />
                <Text style={[styles.namePickerOptionText, { color: theme.emerald }]}>Create new case name</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

type Props = {
  projectId: string;
  session: ApiSession;
  initialContact?: { name?: string; number: string } | null;
  onBack: () => void;
  onCreated: () => void;
};

export function CreateCaseScreen({
  projectId,
  session,
  initialContact,
  onBack,
  onCreated,
}: Props) {
  const theme = useTheme();

  const [selectedContact, setSelectedContact] = useState<any>(initialContact || null);
  const [caseName, setCaseName] = useState('');
  const [caseRemark, setCaseRemark] = useState('');
  const [caseStatus, setCaseStatus] = useState<'open' | 'closed'>('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualNumberInput, setManualNumberInput] = useState<boolean>(false);
  const [manualNumber, setManualNumber] = useState('');

  // Contact picker modal
  const [contactSearchModalOpen, setContactSearchModalOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsQuery, setContactsQuery] = useState('');

  // Custom case names
  const [caseNames, setCaseNames] = useState<string[]>([]);
  const [newCaseName, setNewCaseName] = useState('');
  const [isCreatingCaseName, setIsCreatingCaseName] = useState(false);

  useEffect(() => {
    loadCaseNames().then(setCaseNames);
  }, []);

  const createNewCaseName = async () => {
    const name = newCaseName.trim();
    if (!name) {
      setError('Case name is required');
      return;
    }
    const names = await saveCustomCaseName(name);
    setCaseNames(names);
    setCaseName(name);
    setNewCaseName('');
    setIsCreatingCaseName(false);
  };

  const searchContacts = useCallback(
    async (query: string) => {
      if (!projectId || !session?.token) return;
      setContactsLoading(true);
      try {
        const res = await getContactList(session, projectId, 1, 30, query);
        const list = res?.data || res?.list || [];
        setContacts(
          (Array.isArray(list) ? list : []).map((c: any) => ({
            id: c.contact_id || c.id,
            name: c.name || c.contact_name,
            number: c.number || c.phone,
            firm_name: c.firm_name,
          })),
        );
      } catch {
        setContacts([]);
      } finally {
        setContactsLoading(false);
      }
    },
    [projectId, session],
  );

  // Debounced search when query changes while modal is open
  useEffect(() => {
    if (!contactSearchModalOpen) return;
    const timer = setTimeout(() => {
      searchContacts(contactsQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactsQuery, contactSearchModalOpen, searchContacts]);

  const openContactPicker = () => {
    setContactsQuery('');
    setContactSearchModalOpen(true);
    searchContacts('');
  };

  const handleCreateCase = async () => {
    const num = manualNumberInput
      ? manualNumber.trim()
      : selectedContact?.number;
    if (!num) {
      setError('Please select or enter a contact number');
      return;
    }
    const name = caseName.trim();
    if (!name) {
      setError('Case name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await createCase(
        session,
        projectId,
        num,
        name,
        caseRemark.trim(),
        caseStatus,
      );

      if (res?.error) {
        setError(typeof res.error === 'string' ? res.error : res.msg || 'Failed to create case');
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Case Created',
        text2: 'New case created successfully',
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidView style={[styles.container, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <ScalePressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
          </ScalePressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.ink }]} numberOfLines={1}>
              Create Case
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]} numberOfLines={1}>
              Select a contact and enter case details
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
            <AlertCircle size={16} color="#DC2626" />
            <Text style={[styles.errorBoxText, { color: '#B91C1C' }]}>{error}</Text>
          </View>
        ) : null}

        {/* Step 1: Contact Selection */}
        <View>
          <Text style={[styles.formLabel, { color: theme.muted }]}>CONTACT *</Text>
          {selectedContact && !manualNumberInput ? (
            <View style={[styles.selectedContactCard, { backgroundColor: theme.canvas, borderColor: theme.emerald }]}>
              <View style={[styles.contactAvatar, { backgroundColor: theme.mint }]}>
                <Text style={[styles.contactAvatarText, { color: theme.mintText }]}>
                  {selectedContact.name?.charAt(0).toUpperCase() || 'C'}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.contactName, { color: theme.ink }]}>
                  {selectedContact.name || 'Contact'}
                </Text>
                <Text style={[styles.contactPhone, { color: theme.muted }]}>
                  {selectedContact.number}
                </Text>
              </View>
              <Pressable
                onPress={openContactPicker}
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
              <Pressable
                onPress={openContactPicker}
                style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}
              >
                <Search size={16} color={theme.muted} />
                <Text style={[styles.input, { color: theme.muted }]} numberOfLines={1}>
                  Choose contact...
                </Text>
              </Pressable>

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
          <CaseNameSelect
            value={caseName}
            options={caseNames}
            onChange={(value: string) => {
              setCaseName(value);
              setError('');
            }}
            onCreateNew={() => {
              setNewCaseName('');
              setIsCreatingCaseName(true);
            }}
            theme={theme}
          />
          {isCreatingCaseName && (
            <View style={styles.newNameRow}>
              <TextInput
                value={newCaseName}
                onChangeText={setNewCaseName}
                placeholder="New case name"
                placeholderTextColor={theme.muted}
                style={[styles.newNameInput, { color: theme.ink, borderColor: theme.border, backgroundColor: theme.canvas }]}
              />
              <Pressable onPress={createNewCaseName} style={[styles.newNameButton, { backgroundColor: theme.emerald }]}>
                <Text style={styles.newNameButtonText}>Add</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View>
          <Text style={[styles.formLabel, { color: theme.muted }]}>REMARK</Text>
          <View style={[styles.inputRow, styles.textAreaRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
            <TextInput
              value={caseRemark}
              onChangeText={setCaseRemark}
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
              onPress={() => setCaseStatus('open')}
              style={[
                styles.statusToggleBtn,
                { borderColor: theme.border, backgroundColor: theme.canvas },
                caseStatus === 'open' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
              ]}
            >
              <Text
                style={[
                  styles.statusToggleBtnText,
                  { color: caseStatus === 'open' ? '#FFF' : theme.muted },
                ]}
              >
                Open
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCaseStatus('closed')}
              style={[
                styles.statusToggleBtn,
                { borderColor: theme.border, backgroundColor: theme.canvas },
                caseStatus === 'closed' && { backgroundColor: '#10B981', borderColor: '#10B981' },
              ]}
            >
              <Text
                style={[
                  styles.statusToggleBtnText,
                  { color: caseStatus === 'closed' ? '#FFF' : theme.muted },
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
          disabled={loading}
          style={[styles.submitButton, { backgroundColor: theme.emerald }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Create Case</Text>
          )}
        </ScalePressable>
      </ScrollView>

      {/* Contact Picker Modal */}
      <SlideUpModal
        visible={contactSearchModalOpen}
        onClose={() => setContactSearchModalOpen(false)}
        maxHeight="80%"
      >
        <KeyboardAvoidView style={{ flex: 0 }}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Select Contact</Text>
              <ScalePressable onPress={() => setContactSearchModalOpen(false)} hitSlop={8}>
                <X size={20} color={theme.muted} />
              </ScalePressable>
            </View>

            <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border, marginTop: 12 }]}>
              <Search size={16} color={theme.muted} />
              <TextInput
                value={contactsQuery}
                onChangeText={setContactsQuery}
                placeholder="Search contact name or number..."
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.ink }]}
              />
            </View>

            {contactsLoading ? (
              <ActivityIndicator color={theme.emerald} style={{ padding: 24 }} />
            ) : (
              <FlatList
                data={contacts}
                keyExtractor={(c, index) => String(c.id || c.number || index)}
                style={{ maxHeight: 360, marginTop: 10 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={{ textAlign: 'center', padding: 20, color: theme.muted, fontSize: 13 }}>
                    No contacts found
                  </Text>
                }
                renderItem={({ item: c }) => (
                  <ScalePressable
                    onPress={() => {
                      setSelectedContact(c);
                      setContactSearchModalOpen(false);
                    }}
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
                  </ScalePressable>
                )}
              />
            )}
          </View>
        </KeyboardAvoidView>
      </SlideUpModal>
    </KeyboardAvoidView>
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
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  errorBoxText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  textAreaRow: {
    height: 84,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  textArea: {
    textAlignVertical: 'top',
    height: '100%',
  },
  selectedContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  changeContactBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  changeContactBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  statusToggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  namePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  namePicker: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    maxHeight: 340,
  },
  namePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  namePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  namePickerOptionText: {
    fontSize: 14,
  },
  newNameRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  newNameInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  newNameButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  newNameButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: 18,
    width: '100%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  contactPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  contactPickerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPickerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  contactPickerPhone: {
    fontSize: 11,
    marginTop: 1,
  },
});
