import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  Briefcase,
  FolderEdit,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Camera,
  Mail,
  Phone,
  Globe,
  FileText,
  Sparkles,
  QrCode,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ApiSession } from '../api/client';
import { editProject, getProjectMeta } from '../api/workspace';
import { uploadFile } from '../api/upload';
import { formatImageUrl } from '../utils/imageUrl';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';
import { ScalePressable, FadeInView } from '../components/animations';
import { ProjectQRModal } from '../components/Modals/ProjectQRModal';

export function ManageProjectScreen({
  session,
  projectId,
  onBack,
  onUpdated,
}: {
  session: ApiSession;
  projectId: string;
  onBack: () => void;
  onUpdated?: () => void;
}) {
  const theme = useTheme();

  // Data loading
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [errorMeta, setErrorMeta] = useState('');
  const [metaDetails, setMetaDetails] = useState<any>(null);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setErrorMeta('');
    try {
      const res = await getProjectMeta(session, projectId);
      // Backend returns `{ data: { is_waba_connected, project, charges, profile } }`
      const data = res.data || {};
      setMetaDetails(data);

      const proj = data.project || {};
      const prof = data.profile || {};

      setProjectName(proj.name || proj.project_name || '');
      setCompanyName(prof.firm_name || prof.company_name || proj.company_name || '');
      const rawImg =
        proj.profile_image ||
        proj.profile_picture ||
        proj.profile_picture_url ||
        proj.profile_photo ||
        proj.photo ||
        proj.logo ||
        proj.image ||
        proj.avatar ||
        prof.profile_picture_url ||
        prof.profile_image ||
        prof.profile_picture ||
        prof.image ||
        data.profile_picture ||
        '';
      setProfileImage(formatImageUrl(rawImg));
      setDescription(proj.description || prof.description || '');
      setWebsite(proj.website || prof.website || '');
      setEmail(proj.email || prof.email || '');
      setMobile(proj.mobile || prof.mobile || '');
    } catch (err) {
      setErrorMeta(err instanceof Error ? err.message : 'Could not load project details.');
    } finally {
      setLoadingMeta(false);
    }
  }, [projectId, session.token, session.username]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });

      if (result.didCancel || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];

      setUploadingImage(true);
      const uploaded = await uploadFile({
        uri: asset.uri!,
        name: asset.fileName || `project-logo-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      });

      if (uploaded.success && uploaded.url) {
        const formatted = formatImageUrl(uploaded.url);
        setProfileImage(formatted);
        Toast.show({
          type: 'success',
          text1: 'Photo Uploaded',
          text2: 'Photo uploaded. Save changes to update project.',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: err.message || 'Could not upload image.',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      Toast.show({ type: 'error', text1: 'Project Name Required' });
      return;
    }
    if (!companyName.trim()) {
      Toast.show({ type: 'error', text1: 'Company Name Required' });
      return;
    }

    setSaving(true);
    try {
      await editProject(session, {
        project_id: projectId,
        project_name: projectName.trim(),
        company_name: companyName.trim(),
        profile_image: profileImage,
        logo: profileImage,
        image: profileImage,
        description: description.trim(),
        website: website.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
      });

      Toast.show({
        type: 'success',
        text1: 'Changes Saved',
        text2: 'Project details updated successfully.',
      });
      onUpdated?.();
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
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Manage Project</Text>
        <View style={styles.headerRight} />
      </View>

      <LoadState loading={loadingMeta} error={errorMeta} empty={false} onRetry={loadMeta} />

      {!loadingMeta && !errorMeta && metaDetails && (
        <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Meta Information Cards */}
            <FadeInView distance={8} duration={300}>
              <View style={styles.statusCardsRow}>
                <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.statusLabel, { color: theme.muted }]}>STATUS</Text>
                  <Text style={[styles.statusValue, { color: proj.status === 'active' ? theme.emerald : theme.ink }]}>
                    {proj.status ? proj.status.charAt(0).toUpperCase() + proj.status.slice(1) : 'Active'}
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
                <InfoRow label="Messaging Tier" value={proj.wa_messaging_tier || 'TIER_1'} theme={theme} />
                <InfoRow label="Daily Template Limit" value={String(proj.daily_template_limit || '1,000')} theme={theme} />
                <InfoRow label="Billing Currency" value={proj.billing_currency || 'INR'} theme={theme} />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>MESSAGE CHARGES</Text>
                <InfoRow label="Marketing" value={`₹${charges.marketing || 0.85}`} theme={theme} />
                <InfoRow label="Utility" value={`₹${charges.utility || 0.35}`} theme={theme} />
                <InfoRow label="Authentication" value={`₹${charges.authentication || 0.35}`} theme={theme} />
              </View>

              {/* QR Code Action Banner */}
              <Pressable
                onPress={() => setShowQRModal(true)}
                style={({ pressed }) => [
                  styles.qrBanner,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && { backgroundColor: theme.cardHover },
                ]}
              >
                <View style={[styles.qrBannerIcon, { backgroundColor: theme.mint }]}>
                  <QrCode size={22} color={theme.emerald} />
                </View>
                <View style={styles.qrBannerText}>
                  <Text style={[styles.qrBannerTitle, { color: theme.ink }]}>
                    Project QR Code
                  </Text>
                  <Text style={[styles.qrBannerSubtitle, { color: theme.muted }]}>
                    View, download & share your WhatsApp QR codes
                  </Text>
                </View>
                <View style={[styles.qrBannerButton, { backgroundColor: theme.emerald }]}>
                  <Text style={styles.qrBannerButtonText}>View QR</Text>
                </View>
              </Pressable>
            </FadeInView>

            {/* Edit Project Section */}
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Edit Project Details</Text>

            <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
              {/* Profile Image / Logo Picker */}
              <View style={styles.avatarSection}>
                <ScalePressable
                  onPress={handlePickImage}
                  disabled={uploadingImage}
                  style={[styles.avatarWrapper, { borderColor: theme.emerald }]}
                >
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.mint }]}>
                      <Text style={[styles.avatarInitial, { color: theme.emerald }]}>
                        {projectName.trim().charAt(0).toUpperCase() || 'P'}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.cameraBadge, { backgroundColor: theme.emerald }]}>
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Camera size={14} color="#FFF" />
                    )}
                  </View>
                </ScalePressable>
                <View style={styles.avatarMeta}>
                  <Text style={[styles.avatarTitle, { color: theme.ink }]}>Project Profile Image</Text>
                  <ScalePressable onPress={handlePickImage} disabled={uploadingImage}>
                    <Text style={[styles.changePhotoText, { color: theme.emerald }]}>
                      {uploadingImage ? 'Uploading...' : profileImage ? 'Change Image' : 'Upload Image'}
                    </Text>
                  </ScalePressable>
                </View>
              </View>

              {/* Project Name */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>PROJECT NAME *</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <FolderEdit size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={projectName}
                    onChangeText={setProjectName}
                    autoCapitalize="words"
                    placeholder="e.g. Main Workspace"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              {/* Company / Firm Name */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>COMPANY / FIRM NAME *</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Briefcase size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    autoCapitalize="words"
                    placeholder="e.g. Acme Corp"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>BUSINESS EMAIL</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Mail size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="contact@company.com"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              {/* Mobile Phone */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>CONTACT PHONE</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Phone size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    keyboardType="phone-pad"
                    placeholder="+91 9876543210"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              {/* Website */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>WEBSITE</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Globe size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={website}
                    onChangeText={setWebsite}
                    keyboardType="url"
                    autoCapitalize="none"
                    placeholder="https://example.com"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              {/* Description */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>DESCRIPTION</Text>
                <View style={[styles.inputRow, styles.textAreaRow, fieldStyle]}>
                  <FileText size={17} color={theme.muted} strokeWidth={2.25} style={{ marginTop: 12 }} />
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    placeholder="Brief description about this workspace..."
                    placeholderTextColor={theme.muted}
                    style={[styles.input, styles.textArea, { color: theme.ink }]}
                  />
                </View>
              </View>

              {/* Save Button */}
              <ScalePressable
                accessibilityRole="button"
                disabled={saving || uploadingImage || (!companyName.trim() && !projectName.trim())}
                onPress={handleSave}
                style={[
                  styles.button,
                  { backgroundColor: theme.emerald, shadowColor: theme.emeraldDark },
                  (saving || uploadingImage || (!companyName.trim() && !projectName.trim())) && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </ScalePressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Project QR Modal */}
      {showQRModal && (
        <ProjectQRModal
          visible={showQRModal}
          onClose={() => setShowQRModal(false)}
          session={session}
          projectId={projectId}
          projectName={projectName || 'Project'}
          projectImage={profileImage}
        />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
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
    marginBottom: 16,
    marginHorizontal: 4,
  },
  divider: {
    height: 1,
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
  qrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    marginHorizontal: 4,
    gap: 12,
  },
  qrBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBannerText: {
    flex: 1,
  },
  qrBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  qrBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  qrBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  qrBannerButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
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
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    position: 'relative',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarMeta: {
    flex: 1,
  },
  avatarTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
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
  textAreaRow: {
    height: 86,
    alignItems: 'flex-start',
  },
  input: { flex: 1, fontSize: 15, height: '100%' },
  textArea: {
    height: '100%',
    paddingTop: 10,
    textAlignVertical: 'top',
  },
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
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.65 },
});
