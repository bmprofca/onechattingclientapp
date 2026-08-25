import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  FileText,
  AlertCircle,
  Plus,
  Check,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { editCase } from '../api/workspace';
import { useTheme } from '../theme/theme';
import { ScalePressable } from '../components/animations';
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
  caseItem: any;
  onBack: () => void;
  onSaved: () => void;
};

export function EditCaseScreen({
  projectId,
  session,
  caseItem,
  onBack,
  onSaved,
}: Props) {
  const theme = useTheme();

  const [name, setName] = useState(caseItem?.name || '');
  const [remark, setRemark] = useState(caseItem?.remark || '');
  const [status, setStatus] = useState<'open' | 'closed'>(
    caseItem?.status === true || caseItem?.status === '1' || caseItem?.status === 'open'
      ? 'open'
      : 'closed',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [caseNames, setCaseNames] = useState<string[]>([]);
  const [newCaseName, setNewCaseName] = useState('');
  const [creatingCaseName, setCreatingCaseName] = useState(false);

  useEffect(() => {
    loadCaseNames().then(setCaseNames);
  }, []);

  const createNewCaseName = async () => {
    const trimmed = newCaseName.trim();
    if (!trimmed) {
      setError('Case name is required');
      return;
    }
    const names = await saveCustomCaseName(trimmed);
    setCaseNames(names);
    setName(trimmed);
    setNewCaseName('');
    setCreatingCaseName(false);
  };

  const handleSave = async () => {
    const caseId = caseItem?.case_id || caseItem?.id;
    if (!caseId) {
      setError('Invalid case ID');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Case name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await editCase(
        session,
        projectId,
        caseId,
        trimmedName,
        remark.trim(),
        status,
      );

      if (res?.error) {
        setError(
          typeof res.error === 'string'
            ? res.error
            : res.msg || 'Failed to update case',
        );
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Case Updated',
        text2: 'Case updated successfully',
      });
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to update case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidView style={[styles.container, { backgroundColor: theme.canvas }]}>
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
              Edit Case
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]} numberOfLines={1}>
              {caseItem?.name || 'Update case details'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
            ]}
          >
            <AlertCircle size={16} color="#DC2626" />
            <Text style={[styles.errorBoxText, { color: '#B91C1C' }]}>{error}</Text>
          </View>
        ) : null}

        {/* Case Name Picker */}
        <View>
          <Text style={[styles.formLabel, { color: theme.muted }]}>CASE NAME *</Text>
          <CaseNameSelect
            value={name}
            options={caseNames}
            onChange={(value: string) => {
              setName(value);
              setError('');
            }}
            onCreateNew={() => {
              setNewCaseName('');
              setCreatingCaseName(true);
            }}
            theme={theme}
          />
          {creatingCaseName && (
            <View style={styles.newNameRow}>
              <TextInput
                value={newCaseName}
                onChangeText={setNewCaseName}
                placeholder="New case name"
                placeholderTextColor={theme.muted}
                style={[
                  styles.newNameInput,
                  {
                    color: theme.ink,
                    borderColor: theme.border,
                    backgroundColor: theme.canvas,
                  },
                ]}
              />
              <Pressable
                onPress={createNewCaseName}
                style={[styles.newNameButton, { backgroundColor: theme.emerald }]}
              >
                <Text style={styles.newNameButtonText}>Add</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Remark */}
        <View>
          <Text style={[styles.formLabel, { color: theme.muted }]}>REMARK</Text>
          <View
            style={[
              styles.inputRow,
              styles.textAreaRow,
              { backgroundColor: theme.canvas, borderColor: theme.border },
            ]}
          >
            <TextInput
              value={remark}
              onChangeText={setRemark}
              multiline
              numberOfLines={3}
              placeholder="Remark"
              placeholderTextColor={theme.muted}
              style={[styles.input, styles.textArea, { color: theme.ink }]}
            />
          </View>
        </View>

        {/* Status Toggle */}
        <View>
          <Text style={[styles.formLabel, { color: theme.muted }]}>STATUS</Text>
          <View style={styles.statusToggleRow}>
            <Pressable
              onPress={() => setStatus('open')}
              style={[
                styles.statusToggleBtn,
                { borderColor: theme.border, backgroundColor: theme.canvas },
                status === 'open' && {
                  backgroundColor: '#F59E0B',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusToggleBtnText,
                  { color: status === 'open' ? '#FFF' : theme.muted },
                ]}
              >
                Open
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStatus('closed')}
              style={[
                styles.statusToggleBtn,
                { borderColor: theme.border, backgroundColor: theme.canvas },
                status === 'closed' && {
                  backgroundColor: '#10B981',
                  borderColor: '#10B981',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusToggleBtnText,
                  { color: status === 'closed' ? '#FFF' : theme.muted },
                ]}
              >
                Closed
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Submit */}
        <ScalePressable
          onPress={handleSave}
          disabled={loading}
          style={[styles.submitButton, { backgroundColor: theme.emerald }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Save Changes</Text>
          )}
        </ScalePressable>
      </ScrollView>
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
    alignItems: 'center',
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
    height: 40,
    justifyContent: 'center',
    borderRadius: 8,
  },
  newNameButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
