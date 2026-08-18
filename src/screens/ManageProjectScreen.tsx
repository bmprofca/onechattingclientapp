import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  X,
  Globe,
  Mail,
  MapPin,
  AlignLeft,
  FileText,
  QrCode,
  RefreshCw,
  Wifi,
  WifiOff,
  Info,
  Plus,
  Trash2,
  Briefcase,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ApiSession } from '../api/client';
import {
  editProject,
  getProjectMeta,
  getWabaInformation,
  updateWabaProfileDetails,
  updateWabaProfilePicture,
  WabaProfilePayload,
} from '../api/workspace';
import { uploadFile } from '../api/upload';
import { formatImageUrl } from '../utils/imageUrl';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';
import { ScalePressable, FadeInView } from '../components/animations';
import { ProjectQRModal } from '../components/Modals/ProjectQRModal';

// ------ Business Verticals (matching web app) ------
const BUSINESS_VERTICALS = [
  { name: 'Select business type', value: '' },
  { name: 'UNDEFINED', value: 'UNDEFINED' },
  { name: 'OTHER', value: 'OTHER' },
  { name: 'AUTO', value: 'AUTO' },
  { name: 'BEAUTY', value: 'BEAUTY' },
  { name: 'APPAREL', value: 'APPAREL' },
  { name: 'EDUCATION', value: 'EDU' },
  { name: 'ENTERTAINMENT', value: 'ENTERTAIN' },
  { name: 'EVENT PLAN', value: 'EVENT_PLAN' },
  { name: 'FINANCE', value: 'FINANCE' },
  { name: 'GROCERY', value: 'GROCERY' },
  { name: 'GOVT', value: 'GOVT' },
  { name: 'HOTEL', value: 'HOTEL' },
  { name: 'HEALTH', value: 'HEALTH' },
  { name: 'NON PROFIT ORGANIZATION', value: 'NONPROFIT' },
  { name: 'PROFESSIONAL SERVICES', value: 'PROF_SERVICES' },
  { name: 'RETAIL', value: 'RETAIL' },
  { name: 'TRAVEL', value: 'TRAVEL' },
  { name: 'RESTAURANT', value: 'RESTAURANT' },
  { name: 'NOT A BUSINESS', value: 'NOT_A_BIZ' },
];

const formatVerticalLabel = (value?: string) => (value || '').replace(/_/g, ' ');

export function ManageProjectScreen({
  session,
  projectId,
  onBack,
  onUpdated,
  onOpenWaba,
}: {
  session: ApiSession;
  projectId: string;
  onBack: () => void;
  onUpdated?: () => void;
  onOpenWaba?: () => void;
}) {
  const theme = useTheme();

  // Data loading
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [errorMeta, setErrorMeta] = useState('');
  const [metaDetails, setMetaDetails] = useState<any>(null);
  const [wabaInfo, setWabaInfo] = useState<any>(null);
  const [loadingWaba, setLoadingWaba] = useState(false);

  // Project edit form
  const [projectName, setProjectName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // WABA profile edit form (separate)
  const [isWabaConnected, setIsWabaConnected] = useState(false);
  const [isEditingWaba, setIsEditingWaba] = useState(false);
  const [isSavingWaba, setIsSavingWaba] = useState(false);
  const [isUploadingWabaPicture, setIsUploadingWabaPicture] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showManualRefresh, setShowManualRefresh] = useState(false);
  const [wabaForm, setWabaForm] = useState({
    about: '',
    description: '',
    vertical: '',
    address: '',
    email: '',
    profile_picture_url: '',
    websites: [] as string[],
  });
  const [originalWabaForm, setOriginalWabaForm] = useState(wabaForm);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  // QR modal
  const [showQRModal, setShowQRModal] = useState(false);

  // Vertical picker modal
  const [showVerticalPicker, setShowVerticalPicker] = useState(false);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setErrorMeta('');
    try {
      const res = await getProjectMeta(session, projectId);
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

      // WABA connection
      const connected = data.is_waba_connected !== false;
      setIsWabaConnected(connected);

      if (connected && prof) {
        const form = {
          about: prof.about || '',
          description: prof.description || '',
          vertical: prof.vertical || '',
          address: prof.address || '',
          email: prof.email || '',
          profile_picture_url: prof.profile_picture_url || '',
          websites: Array.isArray(prof.websites) ? prof.websites : [],
        };
        setWabaForm(form);
        setOriginalWabaForm(form);
      }
    } catch (err) {
      setErrorMeta(err instanceof Error ? err.message : 'Could not load project details.');
    } finally {
      setLoadingMeta(false);
    }
  }, [projectId, session.token, session.username]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadWabaInfo = useCallback(async () => {
    setLoadingWaba(true);
    try {
      const res = await getWabaInformation(session, projectId);
      if (!res.error && res.data) setWabaInfo(res.data);
    } catch { /* Not yet linked */ } finally {
      setLoadingWaba(false);
    }
  }, [projectId, session.token, session.username]);

  useEffect(() => { loadWabaInfo(); }, [loadWabaInfo]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []);

  // --- Project image ---
  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      setUploadingImage(true);
      const uploaded = await uploadFile({
        uri: asset.uri!,
        name: asset.fileName || `project-logo-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      });
      if (uploaded.success && uploaded.url) {
        setProfileImage(formatImageUrl(uploaded.url));
        Toast.show({ type: 'success', text1: 'Photo Uploaded', text2: 'Save changes to update project.' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: err.message || 'Could not upload image.' });
    } finally {
      setUploadingImage(false);
    }
  };

  // --- WABA profile picture ---
  const handlePickWabaPicture = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      setIsUploadingWabaPicture(true);
      const uploaded = await uploadFile({
        uri: asset.uri!,
        name: asset.fileName || `waba-profile-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      });
      if (uploaded.success && uploaded.url) {
        const url = formatImageUrl(uploaded.url);
        setWabaForm(f => ({ ...f, profile_picture_url: url }));
        Toast.show({ type: 'success', text1: 'Photo Uploaded', text2: 'Save profile to apply.' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: err.message || 'Could not upload image.' });
    } finally {
      setIsUploadingWabaPicture(false);
    }
  };

  // --- Save project details ---
  const handleSave = async () => {
    if (!projectName.trim()) { Toast.show({ type: 'error', text1: 'Project Name Required' }); return; }
    if (!companyName.trim()) { Toast.show({ type: 'error', text1: 'Company Name Required' }); return; }
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
      Toast.show({ type: 'success', text1: 'Changes Saved', text2: 'Project details updated successfully.' });
      onUpdated?.();
      loadMeta();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: error instanceof Error ? error.message : 'Unable to update project.' });
    } finally {
      setSaving(false);
    }
  };

  // --- Save WABA profile ---
  const handleSaveWabaProfile = async () => {
    setIsSavingWaba(true);
    try {
      const payload: WabaProfilePayload = {
        project_id: projectId,
        about: wabaForm.about,
        description: wabaForm.description,
        vertical: wabaForm.vertical,
        address: wabaForm.address,
        email: wabaForm.email,
        websites: wabaForm.websites.filter(w => w.trim() !== ''),
        ...(wabaForm.profile_picture_url ? { profile_picture: wabaForm.profile_picture_url } : {}),
      };
      await updateWabaProfileDetails(session, payload);
      setOriginalWabaForm(wabaForm);
      setIsEditingWaba(false);
      Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'WABA profile updated successfully.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: err.message || 'Failed to update WABA profile.' });
    } finally {
      setIsSavingWaba(false);
    }
  };

  const handleCancelWaba = () => {
    setWabaForm(originalWabaForm);
    setIsEditingWaba(false);
  };

  // --- Manual refresh (check connection) ---
  const handleManualRefresh = async () => {
    setIsSyncing(true);
    setShowManualRefresh(false);
    try {
      const res = await getProjectMeta(session, projectId);
      if (res?.data) {
        const connected = res.data.is_waba_connected !== false;
        setIsWabaConnected(connected);
        if (connected) {
          setMetaDetails(res.data);
          const prof = res.data.profile || {};
          const form = {
            about: prof.about || '',
            description: prof.description || '',
            vertical: prof.vertical || '',
            address: prof.address || '',
            email: prof.email || '',
            profile_picture_url: prof.profile_picture_url || '',
            websites: Array.isArray(prof.websites) ? prof.websites : [],
          };
          setWabaForm(form);
          setOriginalWabaForm(form);
          Toast.show({ type: 'success', text1: 'Connected!', text2: 'WhatsApp Business Account connected.' });
        } else {
          setShowManualRefresh(true);
        }
      }
    } catch {
      setShowManualRefresh(true);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Helpers ---
  const addWebsite = () => setWabaForm(f => ({ ...f, websites: [...f.websites, ''] }));
  const removeWebsite = (i: number) => setWabaForm(f => ({ ...f, websites: f.websites.filter((_, idx) => idx !== i) }));
  const updateWebsite = (i: number, val: string) => {
    const arr = [...wabaForm.websites];
    arr[i] = val;
    setWabaForm(f => ({ ...f, websites: arr }));
  };

  const fieldStyle = { backgroundColor: theme.canvas, borderColor: theme.border };
  const proj = metaDetails?.project || {};
  const charges = metaDetails?.charges || {};

  // --- Status badge component ---
  const StatusBadge = ({ status }: { status?: string }) => {
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: '#DCFCE7', text: '#15803D' },
      green: { bg: '#DCFCE7', text: '#15803D' },
      approved: { bg: '#DBEAFE', text: '#1D4ED8' },
      pending: { bg: '#FEF9C3', text: '#A16207' },
      rejected: { bg: '#FEE2E2', text: '#DC2626' },
    };
    const key = (status || '').toLowerCase();
    const c = colors[key] || { bg: theme.surface, text: theme.muted };
    return (
      <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
        <Text style={[styles.statusBadgeText, { color: c.text }]}>{(status || '').toUpperCase()}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Project Details</Text>
        <View style={styles.headerRight} />
      </View>

      <LoadState loading={loadingMeta} error={errorMeta} empty={false} onRetry={loadMeta} />

      {!loadingMeta && !errorMeta && metaDetails && (
        <KeyboardAvoidView style={styles.keyboardArea}>
          <ScrollView
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ================================================================
                SECTION A: NOT CONNECTED — show connect CTA + project info
                ================================================================ */}
            {!isWabaConnected ? (
              <FadeInView distance={8} duration={300}>
                {/* Connect WhatsApp Card */}
                <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.connectHeader}>
                    <View style={[styles.connectIconWrap, { backgroundColor: '#FEF3C7' }]}>
                      <WifiOff size={24} color="#D97706" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.connectTitle, { color: theme.ink }]}>Connect WhatsApp</Text>
                      <Text style={[styles.connectSubtitle, { color: theme.muted }]}>
                        Link your Meta Business account to start sending messages
                      </Text>
                    </View>
                  </View>

                  {/* Sync / Refresh state */}
                  {isSyncing ? (
                    <View style={styles.syncingArea}>
                      <ActivityIndicator color={theme.emerald} size="large" />
                      <Text style={[styles.syncingText, { color: theme.muted }]}>Updating / Syncing...</Text>
                    </View>
                  ) : showManualRefresh ? (
                    <View style={styles.syncingArea}>
                      <Text style={[styles.syncingText, { color: theme.muted, marginBottom: 12 }]}>
                        Connection status not updated. Please refresh manually.
                      </Text>
                      <ScalePressable
                        onPress={handleManualRefresh}
                        style={[styles.refreshButton, { backgroundColor: theme.emerald }]}
                      >
                        <RefreshCw size={16} color="#FFF" />
                        <Text style={styles.refreshButtonText}>Refresh Status</Text>
                      </ScalePressable>
                    </View>
                  ) : (
                    <ScalePressable
                      onPress={onOpenWaba}
                      disabled={!onOpenWaba}
                      style={[styles.connectButton, { backgroundColor: theme.emerald, opacity: onOpenWaba ? 1 : 0.5 }]}
                    >
                      <Wifi size={18} color="#FFF" />
                      <Text style={styles.connectButtonText}>Sign Up with Meta / Connect</Text>
                    </ScalePressable>
                  )}
                </View>

                {/* Project Information (read-only) */}
                <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Info size={16} color={theme.emerald} />
                    <Text style={[styles.sectionTitle, { color: theme.ink }]}>Project Information</Text>
                  </View>
                  <View style={styles.readonlyList}>
                    <View style={styles.readonlyRow}>
                      <Text style={[styles.readonlyLabel, { color: theme.muted }]}>Project Status</Text>
                      <StatusBadge status={proj.status} />
                    </View>
                    <ReadOnlyField label="Project Name" value={proj.name || proj.project_name} theme={theme} />
                    <ReadOnlyField label="Messaging Tier" value={proj.wa_messaging_tier} theme={theme} />
                    <ReadOnlyField label="Daily Limit" value={String(proj.daily_template_limit || '')} theme={theme} />
                  </View>
                </View>
              </FadeInView>
            ) : (
              /* ================================================================
                 SECTION B: CONNECTED — WABA profile + edit + project info
                 ================================================================ */
              <FadeInView distance={8} duration={300}>
                {/* QR Code banner */}
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.qrBannerTitle, { color: theme.ink }]}>Project QR Code</Text>
                    <Text style={[styles.qrBannerSubtitle, { color: theme.muted }]}>
                      View, download & share your WhatsApp QR codes
                    </Text>
                  </View>
                  <View style={[styles.qrBannerButton, { backgroundColor: theme.emerald }]}>
                    <Text style={styles.qrBannerButtonText}>View QR</Text>
                  </View>
                </Pressable>

                {/* ---- WABA Profile Section ---- */}
                <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {/* Section header */}
                  <View style={styles.wabaSectionHeader}>
                    <View style={styles.sectionHeaderRow}>
                      <Wifi size={16} color={theme.emerald} />
                      <Text style={[styles.sectionTitle, { color: theme.ink }]}>WhatsApp Business Profile</Text>
                      <View style={[styles.connectedBadge, { backgroundColor: theme.mint }]}>
                        <Text style={[styles.connectedBadgeText, { color: theme.emerald }]}>ACTIVE</Text>
                      </View>
                    </View>
                    {!isEditingWaba ? (
                      <ScalePressable
                        onPress={() => setIsEditingWaba(true)}
                        style={[styles.editBtn, { borderColor: theme.border, backgroundColor: theme.canvas }]}
                      >
                        <Edit2 size={14} color={theme.ink} />
                        <Text style={[styles.editBtnText, { color: theme.ink }]}>Edit</Text>
                      </ScalePressable>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable onPress={handleCancelWaba} style={[styles.editBtn, { borderColor: theme.border, backgroundColor: theme.canvas }]}>
                          <X size={14} color={theme.muted} />
                          <Text style={[styles.editBtnText, { color: theme.muted }]}>Cancel</Text>
                        </Pressable>
                        <ScalePressable
                          onPress={handleSaveWabaProfile}
                          disabled={isSavingWaba}
                          style={[styles.editBtn, { backgroundColor: theme.emerald, borderColor: theme.emerald }]}
                        >
                          {isSavingWaba ? <ActivityIndicator size="small" color="#FFF" /> : <Save size={14} color="#FFF" />}
                          <Text style={[styles.editBtnText, { color: '#FFF' }]}>Save</Text>
                        </ScalePressable>
                      </View>
                    )}
                  </View>

                  {/* Profile Picture + Display Name */}
                  <View style={styles.wabaProfileRow}>
                    <View style={styles.wabaPicWrapper}>
                      {wabaForm.profile_picture_url ? (
                        <Image source={{ uri: wabaForm.profile_picture_url }} style={styles.wabaPic} />
                      ) : (
                        <View style={[styles.wabaPicPlaceholder, { backgroundColor: theme.mint }]}>
                          <Text style={[styles.wabaPicInitial, { color: theme.emerald }]}>
                            {(proj.wa_display_name || proj.name || 'B').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {isEditingWaba && (
                        <Pressable
                          onPress={handlePickWabaPicture}
                          style={[styles.wabaPicOverlay]}
                        >
                          {isUploadingWabaPicture ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Camera size={18} color="#FFF" />
                          )}
                        </Pressable>
                      )}
                    </View>
                    <View style={{ marginLeft: 14, flex: 1 }}>
                      <Text style={[styles.wabaDisplayName, { color: theme.ink }]}>
                        {proj.wa_display_name || proj.name || 'Business Profile'}
                      </Text>
                      <Text style={[styles.wabaVerticalLabel, { color: theme.muted }]}>
                        {formatVerticalLabel(wabaForm.vertical) || 'No industry set'}
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  {/* WABA Profile Fields */}
                  <View style={{ gap: 14 }}>

                    {/* Industry / Vertical */}
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>INDUSTRY / VERTICAL</Text>
                      {isEditingWaba ? (
                        <Pressable
                          onPress={() => setShowVerticalPicker(true)}
                          style={[styles.pickerRow, fieldStyle]}
                        >
                          <Briefcase size={16} color={theme.muted} />
                          <Text style={[styles.pickerText, { color: wabaForm.vertical ? theme.ink : theme.muted }]}>
                            {wabaForm.vertical
                              ? BUSINESS_VERTICALS.find(v => v.value === wabaForm.vertical)?.name || formatVerticalLabel(wabaForm.vertical)
                              : 'Select business type'}
                          </Text>
                        </Pressable>
                      ) : (
                        <View style={[styles.readOnlyBox, { backgroundColor: theme.canvas }]}>
                          <Text style={[styles.readOnlyValue, { color: theme.ink }]}>
                            {formatVerticalLabel(wabaForm.vertical) || '—'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Email */}
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>EMAIL</Text>
                      {isEditingWaba ? (
                        <View style={[styles.inputRow, fieldStyle]}>
                          <Mail size={16} color={theme.muted} />
                          <TextInput
                            value={wabaForm.email}
                            onChangeText={v => setWabaForm(f => ({ ...f, email: v }))}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholder="business@email.com"
                            placeholderTextColor={theme.muted}
                            style={[styles.input, { color: theme.ink }]}
                          />
                        </View>
                      ) : (
                        <View style={[styles.readOnlyBox, { backgroundColor: theme.canvas }]}>
                          <Text style={[styles.readOnlyValue, { color: theme.ink }]}>{wabaForm.email || '—'}</Text>
                        </View>
                      )}
                    </View>

                    {/* Address */}
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>ADDRESS</Text>
                      {isEditingWaba ? (
                        <View style={[styles.inputRow, fieldStyle]}>
                          <MapPin size={16} color={theme.muted} />
                          <TextInput
                            value={wabaForm.address}
                            onChangeText={v => setWabaForm(f => ({ ...f, address: v }))}
                            placeholder="Business address"
                            placeholderTextColor={theme.muted}
                            style={[styles.input, { color: theme.ink }]}
                          />
                        </View>
                      ) : (
                        <View style={[styles.readOnlyBox, { backgroundColor: theme.canvas }]}>
                          <Text style={[styles.readOnlyValue, { color: theme.ink }]}>{wabaForm.address || '—'}</Text>
                        </View>
                      )}
                    </View>

                    {/* About (max 139) */}
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>ABOUT TEXT (MAX 139)</Text>
                      {isEditingWaba ? (
                        <View style={[styles.inputRow, fieldStyle]}>
                          <AlignLeft size={16} color={theme.muted} />
                          <TextInput
                            value={wabaForm.about}
                            onChangeText={v => setWabaForm(f => ({ ...f, about: v.slice(0, 139) }))}
                            placeholder="About text (max 139 characters)"
                            placeholderTextColor={theme.muted}
                            style={[styles.input, { color: theme.ink }]}
                            maxLength={139}
                          />
                          <Text style={{ color: theme.muted, fontSize: 11 }}>{wabaForm.about.length}/139</Text>
                        </View>
                      ) : (
                        <View style={[styles.readOnlyBox, { backgroundColor: theme.canvas }]}>
                          <Text style={[styles.readOnlyValue, { color: theme.ink }]}>{wabaForm.about || '—'}</Text>
                        </View>
                      )}
                    </View>

                    {/* Description */}
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>DESCRIPTION</Text>
                      {isEditingWaba ? (
                        <View style={[styles.inputRow, styles.textAreaRow, fieldStyle]}>
                          <FileText size={16} color={theme.muted} style={{ marginTop: 10 }} />
                          <TextInput
                            value={wabaForm.description}
                            onChangeText={v => setWabaForm(f => ({ ...f, description: v }))}
                            multiline
                            numberOfLines={3}
                            placeholder="Business description"
                            placeholderTextColor={theme.muted}
                            style={[styles.input, styles.textArea, { color: theme.ink }]}
                          />
                        </View>
                      ) : (
                        <View style={[styles.readOnlyBox, { backgroundColor: theme.canvas, minHeight: 52 }]}>
                          <Text style={[styles.readOnlyValue, { color: theme.ink }]}>{wabaForm.description || '—'}</Text>
                        </View>
                      )}
                    </View>

                    {/* Websites */}
                    <View>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>WEBSITES</Text>
                      {isEditingWaba ? (
                        <View style={{ gap: 8 }}>
                          {wabaForm.websites.map((site, i) => (
                            <View key={i} style={[styles.inputRow, fieldStyle]}>
                              <Globe size={16} color={theme.muted} />
                              <TextInput
                                value={site}
                                onChangeText={v => updateWebsite(i, v)}
                                placeholder="https://example.com"
                                placeholderTextColor={theme.muted}
                                keyboardType="url"
                                autoCapitalize="none"
                                style={[styles.input, { color: theme.ink }]}
                              />
                              <Pressable hitSlop={8} onPress={() => removeWebsite(i)}>
                                <Trash2 size={16} color={theme.danger || '#EF4444'} />
                              </Pressable>
                            </View>
                          ))}
                          <Pressable onPress={addWebsite} style={[styles.addWebsiteBtn, { borderColor: theme.emerald }]}>
                            <Plus size={14} color={theme.emerald} />
                            <Text style={[styles.addWebsiteBtnText, { color: theme.emerald }]}>Add Website</Text>
                          </Pressable>
                        </View>
                      ) : (
                        wabaForm.websites.length > 0 ? (
                          wabaForm.websites.map((site, i) => (
                            <View key={i} style={[styles.readOnlyBox, { backgroundColor: theme.canvas, marginBottom: 6 }]}>
                              <Text style={[styles.readOnlyValue, { color: theme.emerald }]}>{site}</Text>
                            </View>
                          ))
                        ) : (
                          <View style={[styles.readOnlyBox, { backgroundColor: theme.canvas }]}>
                            <Text style={[styles.readOnlyValue, { color: theme.ink }]}>—</Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                </View>

                {/* ---- Project & Billing Info ---- */}
                <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Info size={16} color={theme.emerald} />
                    <Text style={[styles.sectionTitle, { color: theme.ink }]}>Project Information</Text>
                  </View>
                  <View style={styles.readonlyList}>
                    <View style={styles.readonlyRow}>
                      <Text style={[styles.readonlyLabel, { color: theme.muted }]}>Project Status</Text>
                      <StatusBadge status={proj.status} />
                    </View>
                    <ReadOnlyField label="Project Name" value={proj.name || proj.project_name} theme={theme} />
                    <ReadOnlyField label="Messaging Tier" value={proj.wa_messaging_tier || 'TIER_1'} theme={theme} />
                    <ReadOnlyField label="Daily Template Limit" value={String(proj.daily_template_limit || '1,000')} theme={theme} />
                    <ReadOnlyField label="Billing Currency" value={proj.billing_currency || 'INR'} theme={theme} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <Text style={[styles.subSectionTitle, { color: theme.muted }]}>MESSAGE CHARGES</Text>
                  <View style={styles.readonlyList}>
                    <ReadOnlyField label="Marketing" value={`₹${charges.marketing || 0.85}`} theme={theme} />
                    <ReadOnlyField label="Utility" value={`₹${charges.utility || 0.35}`} theme={theme} />
                    <ReadOnlyField label="Authentication" value={`₹${charges.authentication || 0.35}`} theme={theme} />
                  </View>
                </View>
              </FadeInView>
            )}

            {/* ================================================================
                SECTION C: Edit Project Details (always visible)
                ================================================================ */}
            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Edit2 size={16} color={theme.emerald} />
                <Text style={[styles.sectionTitle, { color: theme.ink }]}>Edit Project Details</Text>
              </View>

              {/* Profile Image */}
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
                <View style={{ flex: 1 }}>
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
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>PROJECT NAME *</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Briefcase size={17} color={theme.muted} />
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

              {/* Company Name */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>COMPANY / FIRM NAME *</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Briefcase size={17} color={theme.muted} />
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
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>BUSINESS EMAIL</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Mail size={17} color={theme.muted} />
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

              {/* Website */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>WEBSITE</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Globe size={17} color={theme.muted} />
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
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>DESCRIPTION</Text>
                <View style={[styles.inputRow, styles.textAreaRow, fieldStyle]}>
                  <FileText size={17} color={theme.muted} style={{ marginTop: 12 }} />
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
        </KeyboardAvoidView>
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

      {/* Vertical Picker Modal */}
      <Modal
        visible={showVerticalPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerticalPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowVerticalPicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.pickerHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.pickerSheetTitle, { color: theme.ink }]}>Select Industry</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {BUSINESS_VERTICALS.filter(v => v.value !== '').map(vertical => (
                <Pressable
                  key={vertical.value}
                  onPress={() => {
                    setWabaForm(f => ({ ...f, vertical: vertical.value }));
                    setShowVerticalPicker(false);
                  }}
                  style={[
                    styles.pickerOption,
                    { borderBottomColor: theme.border },
                    wabaForm.vertical === vertical.value && { backgroundColor: theme.mint },
                  ]}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    { color: wabaForm.vertical === vertical.value ? theme.emerald : theme.ink },
                  ]}>
                    {vertical.name}
                  </Text>
                  {wabaForm.vertical === vertical.value && (
                    <CheckCircle2 size={16} color={theme.emerald} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ReadOnlyField({ label, value, theme }: { label: string; value?: string; theme: any }) {
  return (
    <View style={styles.readonlyRow}>
      <Text style={[styles.readonlyLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.readonlyValue2, { color: theme.ink }]}>{value || '—'}</Text>
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
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginLeft: -8,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { width: 40 },
  keyboardArea: { flex: 1 },
  page: { padding: 16, paddingBottom: 48, gap: 16 },

  // Generic section card
  section: {
    borderWidth: 1, borderRadius: 20, padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  subSectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10, marginTop: 4 },

  // Connected badge
  connectedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  connectedBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  // Status badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Connect WhatsApp section
  connectHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  connectIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  connectTitle: { fontSize: 16, fontWeight: '800' },
  connectSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  connectButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  connectButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  syncingArea: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  syncingText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  refreshButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  refreshButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // QR Banner
  qrBanner: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: 18, padding: 14, gap: 12,
  },
  qrBannerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  qrBannerTitle: { fontSize: 15, fontWeight: '700' },
  qrBannerSubtitle: { fontSize: 12, marginTop: 2 },
  qrBannerButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  qrBannerButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // WABA Profile Section header
  wabaSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8,
  },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
  },
  editBtnText: { fontSize: 13, fontWeight: '700' },

  // WABA profile pic
  wabaProfileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  wabaPicWrapper: { position: 'relative', width: 72, height: 72 },
  wabaPic: { width: 72, height: 72, borderRadius: 18 },
  wabaPicPlaceholder: {
    width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  wabaPicInitial: { fontSize: 28, fontWeight: '900' },
  wabaPicOverlay: {
    position: 'absolute', inset: 0, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  wabaDisplayName: { fontSize: 18, fontWeight: '800' },
  wabaVerticalLabel: { fontSize: 13, marginTop: 3 },

  // Read-only list
  readonlyList: { gap: 0 },
  readonlyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1,
  },
  readonlyLabel: { fontSize: 13 },
  readonlyValue2: { fontSize: 13, fontWeight: '600' },

  // Read-only display box (for editable fields)
  readOnlyBox: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  readOnlyValue: { fontSize: 14 },

  divider: { height: 1, marginVertical: 14, opacity: 0.5 },

  // Field inputs
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', height: 52,
    borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, gap: 10,
  },
  textAreaRow: { height: 86, alignItems: 'flex-start' },
  input: { flex: 1, fontSize: 15, height: '100%' },
  textArea: { height: '100%', paddingTop: 10, textAlignVertical: 'top' },

  // Vertical picker row
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', height: 52,
    borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, gap: 10,
  },
  pickerText: { flex: 1, fontSize: 15 },

  // Websites
  addWebsiteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed',
  },
  addWebsiteBtnText: { fontSize: 13, fontWeight: '700' },

  // Avatar section (project edit)
  avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 16 },
  avatarWrapper: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, position: 'relative' },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 26, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 24, height: 24,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF',
  },
  avatarTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  changePhotoText: { fontSize: 13, fontWeight: '700' },

  // Save button
  button: {
    height: 54, marginTop: 10, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowOpacity: 0.35, shadowRadius: 9, elevation: 4,
  },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.65 },

  // Vertical picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  pickerHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerSheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1,
  },
  pickerOptionText: { fontSize: 15 },
});
