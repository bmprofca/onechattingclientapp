import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Briefcase, FolderEdit, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { editProject, getProjectMeta } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';

export function ManageProjectScreen({
  session,
  projectId,
  onBack,
}: {
  session: ApiSession;
  projectId: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  
  // Data loading
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [errorMeta, setErrorMeta] = useState('');
  const [metaDetails, setMetaDetails] = useState<any>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setErrorMeta('');
    try {
      const res = await getProjectMeta(session, projectId);
      // Backend returns `{ data: { is_waba_connected, project, charges, profile } }`
      const data = res.data || {};
      setMetaDetails(data);
      // Initialize form if we have existing names in profile or project
      // Often the API doesn't return company_name directly in meta-details, 
      // but we populate what we can. 
      setProjectName(data.project?.name || '');
      setCompanyName(data.profile?.firm_name || data.profile?.company_name || '');
    } catch (err) {
      setErrorMeta(err instanceof Error ? err.message : 'Could not load project details.');
    } finally {
      setLoadingMeta(false);
    }
  }, [projectId, session]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const handleSave = async () => {
    if (!companyName.trim()) {
      Toast.show({ type: 'error', text1: 'Company Name Required' });
      return;
    }
    if (!projectName.trim()) {
      Toast.show({ type: 'error', text1: 'Project Name Required' });
      return;
    }

    setSaving(true);
    try {
      await editProject(session, companyName.trim(), projectName.trim());
      Toast.show({ type: 'success', text1: 'Changes Saved', text2: 'Project details updated successfully.' });
      loadMeta(); // Reload to reflect changes
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error instanceof Error ? error.message : 'Unable to update project.',
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.canvas,
    borderColor: theme.border,
  };

  const proj = metaDetails?.project || {};
  const charges = metaDetails?.charges || {};
  const isVerified = proj.is_whatsapp_verified;

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {/* Sleek Header */}
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <Text style={[styles.backButtonText, { color: theme.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Manage Project</Text>
        <View style={styles.headerRight} />
      </View>

      <LoadState loading={loadingMeta} error={errorMeta} empty={false} onRetry={loadMeta} />

      {!loadingMeta && !errorMeta && metaDetails && (
        <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            
            {/* Meta Information Cards */}
            <View style={styles.statusCardsRow}>
              <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statusLabel, { color: theme.muted }]}>STATUS</Text>
                <Text style={[styles.statusValue, { color: proj.status === 'active' ? theme.emerald : theme.ink }]}>
                  {proj.status ? proj.status.charAt(0).toUpperCase() + proj.status.slice(1) : 'Unknown'}
                </Text>
              </View>
              <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statusLabel, { color: theme.muted }]}>WA VERIFIED</Text>
                <View style={styles.verifiedRow}>
                  {isVerified ? (
                    <CheckCircle2 size={16} color={theme.emerald} />
                  ) : (
                    <AlertCircle size={16} color={theme.danger} />
                  )}
                  <Text style={[styles.statusValue, { color: theme.ink, marginLeft: 6 }]}>
                    {isVerified ? 'Yes' : 'No'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <InfoRow label="Messaging Tier" value={proj.wa_messaging_tier || 'N/A'} theme={theme} />
              <InfoRow label="Daily Template Limit" value={String(proj.daily_template_limit || 0)} theme={theme} />
              <InfoRow label="Billing Currency" value={proj.billing_currency || 'N/A'} theme={theme} />
              <View style={styles.divider} />
              <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>MESSAGE CHARGES</Text>
              <InfoRow label="Marketing" value={`₹${charges.marketing || 0}`} theme={theme} />
              <InfoRow label="Utility" value={`₹${charges.utility || 0}`} theme={theme} />
              <InfoRow label="Authentication" value={`₹${charges.authentication || 0}`} theme={theme} />
            </View>

            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Edit Details</Text>
            
            <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>COMPANY NAME</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Briefcase size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    autoCapitalize="words"
                    placeholder="Acme Corp"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>PROJECT NAME</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <FolderEdit size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={projectName}
                    onChangeText={setProjectName}
                    autoCapitalize="words"
                    placeholder="Main Workspace"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={saving || (!companyName.trim() && !projectName.trim())}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.emerald, shadowColor: theme.emeraldDark },
                  pressed && !saving && styles.buttonPressed,
                  (saving || (!companyName.trim() && !projectName.trim())) && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoRowLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.infoRowValue, { color: theme.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 40,
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  keyboardArea: { flex: 1 },
  page: { padding: 20, paddingBottom: 40 },
  statusCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    marginHorizontal: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2EBE7', // Generic, could use theme.border 
    marginVertical: 12,
    opacity: 0.5,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoRowLabel: {
    fontSize: 14,
  },
  infoRowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    marginHorizontal: 4,
  },
  form: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  field: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, height: '100%' },
  button: {
    height: 54,
    marginTop: 10,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 9,
    elevation: 4,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.65 },
});
