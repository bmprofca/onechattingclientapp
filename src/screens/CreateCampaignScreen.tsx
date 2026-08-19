import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Contacts from 'react-native-contacts';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import Toast from 'react-native-toast-message';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Megaphone,
  Plus,
  Send,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  X,
  Search,
  Smartphone,
  RefreshCw,
  CheckSquare,
  Square,
} from 'lucide-react-native';
import {
  pick,
  types as DocumentPickerTypes,
} from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { ApiSession } from '../api/client';
import {
  createCampaign,
  getContactList,
  getTemplates,
  unwrapList,
} from '../api/workspace';
import { uploadFile } from '../api/upload';
import { useTheme } from '../theme/theme';
import { applyBodyParameters } from '../utils/templateUtils';
import { ScalePressable, FadeInView, SlideUpModal } from '../components/animations';

type Props = {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
  onCreated: (campaignId?: string) => void;
};

export function CreateCampaignScreen({
  projectId,
  session,
  onBack,
  onCreated,
}: Props) {
  const theme = useTheme();

  // Campaign basics
  const [campaignName, setCampaignName] = useState('');
  const [creating, setCreating] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');

  // Template variables & header media
  const [variables, setVariables] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [uploadedMediaName, setUploadedMediaName] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Audience / Recipients state
  const [recipientMode, setRecipientMode] = useState<'manual' | 'contacts' | 'device' | 'csv'>('manual');
  const [manualNumbersText, setManualNumbersText] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  
  // Device / SIM Contacts state
  const [selectedDeviceContacts, setSelectedDeviceContacts] = useState<string[]>([]);
  const [deviceContactsList, setDeviceContactsList] = useState<Array<{ id: string; name: string; number: string }>>([]);
  const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);
  const [deviceContactsSearch, setDeviceContactsSearch] = useState('');
  const [deviceContactsModalOpen, setDeviceContactsModalOpen] = useState(false);
  const [devicePermissionDenied, setDevicePermissionDenied] = useState(false);

  const [csvFileUrl, setCsvFileUrl] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Schedule state
  const [sendType, setSendType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduleTime, setScheduleTime] = useState('');

  // Hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (templatePickerOpen) {
        setTemplatePickerOpen(false);
        return true;
      }
      if (contactsModalOpen) {
        setContactsModalOpen(false);
        return true;
      }
      if (deviceContactsModalOpen) {
        setDeviceContactsModalOpen(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, templatePickerOpen, contactsModalOpen, deviceContactsModalOpen]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await getTemplates(session, projectId, 'APPROVED');
      const list = unwrapList(res);
      setTemplates(list);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [projectId, session]);

  // Load workspace contacts list
  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await getContactList(session, projectId, 1, 100);
      const list = unwrapList(res);
      setContactsList(list);
    } catch {
      setContactsList([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [projectId, session]);

  // Load device & SIM contacts
  const loadDeviceContacts = useCallback(async () => {
    setLoadingDeviceContacts(true);
    setDevicePermissionDenied(false);
    try {
      let hasPermission = false;
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts Permission',
            message: 'OneChat needs access to your device contacts to broadcast campaigns to phone & SIM contacts.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        hasPermission = true;
      }

      if (!hasPermission) {
        setDevicePermissionDenied(true);
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Please allow contacts permission to import device / SIM contacts.',
        });
        return;
      }

      const raw = await Contacts.getAllWithoutPhotos();
      const parsed: Array<{ id: string; name: string; number: string }> = [];
      const seen = new Set<string>();

      raw.forEach((c) => {
        const fullName = [c.givenName, c.middleName, c.familyName]
          .filter(Boolean)
          .join(' ')
          .trim() || c.displayName || 'Unnamed Contact';

        if (Array.isArray(c.phoneNumbers)) {
          c.phoneNumbers.forEach((pn) => {
            const rawNum = pn.number || '';
            const cleaned = rawNum.replace(/[^0-9+]/g, '');
            if (cleaned.length >= 7) {
              const key = `${fullName}-${cleaned}`;
              if (!seen.has(key)) {
                seen.add(key);
                parsed.push({
                  id: `${c.recordID || ''}-${pn.label || ''}-${cleaned}`,
                  name: fullName,
                  number: cleaned,
                });
              }
            }
          });
        }
      });

      parsed.sort((a, b) => a.name.localeCompare(b.name));
      setDeviceContactsList(parsed);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load contacts',
        text2: err?.message || 'Failed to read contacts from device.',
      });
    } finally {
      setLoadingDeviceContacts(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (contactsModalOpen) {
      loadContacts();
    }
  }, [contactsModalOpen, loadContacts]);

  useEffect(() => {
    if (deviceContactsModalOpen && deviceContactsList.length === 0) {
      loadDeviceContacts();
    }
  }, [deviceContactsModalOpen, deviceContactsList.length, loadDeviceContacts]);

  // When user selects a template
  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTemplatePickerOpen(false);

    let vars: string[] = [];
    let defaultMedia = '';

    const components = template.template?.components || template.components || [];
    components.forEach((component: any) => {
      if (component.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format)) {
        const handle = component.example?.header_handle?.[0] || component.example?.header_url?.[0] || '';
        if (handle) {
          defaultMedia = handle;
        }
      }
      if (component.type === 'BODY' && component.text) {
        const matches = component.text.match(/\{\{\d+\}\}/g);
        if (matches) {
          matches.forEach((_: string, idx: number) => {
            const ex = component.example?.body_text?.[0]?.[idx] || '';
            vars.push(ex);
          });
        }
      }
    });

    setVariables(vars);
    setHeaderMediaUrl(defaultMedia);
    setUploadedMediaName(defaultMedia ? 'Default Template Media' : '');
  };

  // Header media upload
  const handlePickHeaderMedia = async () => {
    try {
      const components = selectedTemplate?.template?.components || selectedTemplate?.components || [];
      const headerComp = components.find((c: any) => c.type === 'HEADER');
      const isImg = headerComp?.format === 'IMAGE';

      if (isImg) {
        const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
        if (res.didCancel || !res.assets?.[0]?.uri) return;
        const asset = res.assets[0];

        setUploadingMedia(true);
        const uploaded = await uploadFile({
          uri: asset.uri!,
          name: asset.fileName || `header-${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });

        if (uploaded.success && uploaded.url) {
          setHeaderMediaUrl(uploaded.url);
          setUploadedMediaName(uploaded.meta?.originalName || asset.fileName || 'Custom Image');
          Toast.show({ type: 'success', text1: 'Media Uploaded' });
        }
      } else {
        const [result] = await pick({
          type: [DocumentPickerTypes.pdf, DocumentPickerTypes.video, DocumentPickerTypes.allFiles],
          allowMultiSelection: false,
        });
        if (!result?.uri) return;

        setUploadingMedia(true);
        const uploaded = await uploadFile({
          uri: result.uri,
          name: result.name || 'file',
          type: result.type || 'application/octet-stream',
        });

        if (uploaded.success && uploaded.url) {
          setHeaderMediaUrl(uploaded.url);
          setUploadedMediaName(uploaded.meta?.originalName || result.name || 'Custom File');
          Toast.show({ type: 'success', text1: 'Media Uploaded' });
        }
      }
    } catch (err: any) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        Toast.show({ type: 'error', text1: 'Upload Failed', text2: err.message });
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  // CSV file upload
  const handlePickCsv = async () => {
    try {
      const [result] = await pick({
        type: [DocumentPickerTypes.allFiles, DocumentPickerTypes.csv, DocumentPickerTypes.xls, DocumentPickerTypes.xlsx],
        allowMultiSelection: false,
      });
      if (!result?.uri) return;

      setUploadingCsv(true);
      const uploaded = await uploadFile({
        uri: result.uri,
        name: result.name || 'recipients.csv',
        type: result.type || 'text/csv',
      });

      if (uploaded.success && uploaded.url) {
        setCsvFileUrl(uploaded.url);
        setCsvFileName(uploaded.meta?.originalName || result.name || 'recipients.csv');
        Toast.show({ type: 'success', text1: 'Audience File Uploaded' });
      }
    } catch (err: any) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        Toast.show({ type: 'error', text1: 'Upload Failed', text2: err.message });
      }
    } finally {
      setUploadingCsv(false);
    }
  };

  // Parse phone numbers from manual text area
  const parsedManualNumbers = useMemo(() => {
    const raw = manualNumbersText
      .split(/[\n,;]+/)
      .map((s) => s.trim().replace(/[^0-9+]/g, ''))
      .filter((s) => s.length >= 7);
    return Array.from(new Set(raw));
  }, [manualNumbersText]);

  // Calculate total recipients
  const totalRecipientsCount = useMemo(() => {
    if (recipientMode === 'manual') return parsedManualNumbers.length;
    if (recipientMode === 'contacts') return selectedContacts.length;
    if (recipientMode === 'device') return selectedDeviceContacts.length;
    if (recipientMode === 'csv') return csvFileUrl ? 'File uploaded' : 0;
    return 0;
  }, [recipientMode, parsedManualNumbers, selectedContacts, selectedDeviceContacts, csvFileUrl]);

  // Formatted components for template payload
  const formattedComponents = useMemo(() => {
    if (!selectedTemplate) return [];
    const comps: any[] = [];
    const rawComponents = selectedTemplate.template?.components || selectedTemplate.components || [];

    rawComponents.forEach((component: any) => {
      if (component.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format)) {
        const effectiveMedia = headerMediaUrl || component.example?.header_handle?.[0] || component.example?.header_url?.[0] || '';
        if (effectiveMedia) {
          comps.push({
            type: 'header',
            parameters: [
              {
                type: component.format.toLowerCase(),
                [component.format.toLowerCase()]: { link: effectiveMedia },
              },
            ],
          });
        }
      }
      if (component.type === 'BODY' && component.text) {
        const parameters: any[] = [];
        const matches = component.text.match(/\{\{\d+\}\}/g);
        if (matches) {
          matches.forEach((_: string, idx: number) => {
            parameters.push({
              type: 'text',
              text: variables[idx] || '',
            });
          });
        }
        comps.push({
          type: 'body',
          parameters,
        });
      }
    });

    return comps;
  }, [selectedTemplate, headerMediaUrl, variables]);

  // Live preview text
  const previewBodyText = useMemo(() => {
    if (!selectedTemplate) return '';
    const comps = selectedTemplate.template?.components || selectedTemplate.components || [];
    const bodyComp = comps.find((c: any) => c.type === 'BODY');
    if (!bodyComp) return '';
    const params = variables.map((v) => ({ text: v }));
    return applyBodyParameters(bodyComp.text, params);
  }, [selectedTemplate, variables]);

  // Live header format
  const headerComp = useMemo(() => {
    if (!selectedTemplate) return null;
    const comps = selectedTemplate.template?.components || selectedTemplate.components || [];
    return comps.find((c: any) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));
  }, [selectedTemplate]);

  // Footer & buttons preview
  const footerComp = useMemo(() => {
    if (!selectedTemplate) return null;
    const comps = selectedTemplate.template?.components || selectedTemplate.components || [];
    return comps.find((c: any) => c.type === 'FOOTER');
  }, [selectedTemplate]);

  const buttonComps = useMemo(() => {
    if (!selectedTemplate) return [];
    const comps = selectedTemplate.template?.components || selectedTemplate.components || [];
    const btnComp = comps.find((c: any) => c.type === 'BUTTONS');
    return btnComp?.buttons || [];
  }, [selectedTemplate]);

  // Submit create campaign
  const handleCreate = async () => {
    if (!campaignName.trim()) {
      Toast.show({ type: 'error', text1: 'Campaign Name Required', text2: 'Please name your campaign.' });
      return;
    }
    if (!selectedTemplate) {
      Toast.show({ type: 'error', text1: 'Template Required', text2: 'Please choose an approved template.' });
      return;
    }

    let numbers: string[] = [];
    if (recipientMode === 'manual') {
      if (parsedManualNumbers.length === 0) {
        Toast.show({ type: 'error', text1: 'Recipients Required', text2: 'Enter at least one valid phone number.' });
        return;
      }
      numbers = parsedManualNumbers;
    } else if (recipientMode === 'contacts') {
      if (selectedContacts.length === 0) {
        Toast.show({ type: 'error', text1: 'Contacts Required', text2: 'Select at least one contact.' });
        return;
      }
      numbers = selectedContacts;
    } else if (recipientMode === 'device') {
      if (selectedDeviceContacts.length === 0) {
        Toast.show({ type: 'error', text1: 'Device Contacts Required', text2: 'Select at least one contact from your device / SIM.' });
        return;
      }
      numbers = selectedDeviceContacts;
    } else if (recipientMode === 'csv') {
      if (!csvFileUrl) {
        Toast.show({ type: 'error', text1: 'File Required', text2: 'Please upload a recipients CSV file.' });
        return;
      }
    }

    setCreating(true);
    try {
      const payload: any = {
        project_id: projectId,
        campaign_name: campaignName.trim(),
        template_id: selectedTemplate.template_id || selectedTemplate.id,
        component: formattedComponents,
        is_scheduled: sendType === 'scheduled',
        ...(sendType === 'scheduled' && scheduleTime ? { schedule_time: scheduleTime } : {}),
      };

      if (recipientMode === 'csv') {
        payload.file_url = csvFileUrl;
      } else {
        payload.numbers = numbers;
        payload.contact_list = numbers;
      }

      const res = await createCampaign(session, payload);
      Toast.show({
        type: 'success',
        text1: 'Campaign Created!',
        text2: 'Your campaign has been launched successfully.',
      });
      onCreated(res?.data?.campaign_id || res?.campaign_id);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Campaign Creation Failed',
        text2: err.message || 'Could not dispatch campaign.',
      });
    } finally {
      setCreating(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const lower = templateSearch.toLowerCase();
    return templates.filter((t) =>
      (t.template_name || t.name || '').toLowerCase().includes(lower) ||
      (t.category || '').toLowerCase().includes(lower)
    );
  }, [templates, templateSearch]);

  const filteredContacts = useMemo(() => {
    if (!contactsSearch.trim()) return contactsList;
    const lower = contactsSearch.toLowerCase();
    return contactsList.filter((c) =>
      (c.name || c.contact_name || '').toLowerCase().includes(lower) ||
      (c.number || c.phone || '').includes(lower)
    );
  }, [contactsList, contactsSearch]);

  const filteredDeviceContacts = useMemo(() => {
    if (!deviceContactsSearch.trim()) return deviceContactsList;
    const lower = deviceContactsSearch.toLowerCase();
    return deviceContactsList.filter((c) =>
      c.name.toLowerCase().includes(lower) || c.number.includes(lower)
    );
  }, [deviceContactsList, deviceContactsSearch]);

  const handleToggleSelectAllDeviceContacts = () => {
    const visibleNumbers = filteredDeviceContacts.map((c) => c.number);
    if (visibleNumbers.length === 0) return;
    const allSelected = visibleNumbers.every((n) => selectedDeviceContacts.includes(n));
    if (allSelected) {
      setSelectedDeviceContacts((prev) => prev.filter((n) => !visibleNumbers.includes(n)));
    } else {
      setSelectedDeviceContacts((prev) => Array.from(new Set([...prev, ...visibleNumbers])));
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Create Campaign</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Banner */}
          <FadeInView distance={8} duration={300}>
            <View style={[styles.heroBanner, { backgroundColor: theme.mint, borderColor: theme.border }]}>
              <View style={[styles.heroIconBox, { backgroundColor: theme.emerald }]}>
                <Megaphone size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.heroTitle, { color: theme.ink }]}>WhatsApp Broadcast</Text>
                <Text style={[styles.heroSubtitle, { color: theme.muted }]}>
                  Send high-converting template messages to your target audience.
                </Text>
              </View>
            </View>
          </FadeInView>

          {/* Section 1: Campaign Details */}
          <FadeInView delay={60} distance={10} duration={300}>
            <Text style={[styles.sectionHeading, { color: theme.ink }]}>1. Campaign Name</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.muted }]}>CAMPAIGN NAME *</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                <Megaphone size={18} color={theme.muted} />
                <TextInput
                  value={campaignName}
                  onChangeText={setCampaignName}
                  placeholder="e.g. August Payment Reminder"
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.ink }]}
                />
              </View>
            </View>
          </FadeInView>

          {/* Section 2: Choose Template */}
          <FadeInView delay={120} distance={10} duration={300}>
            <Text style={[styles.sectionHeading, { color: theme.ink }]}>2. Select Message Template</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {!selectedTemplate ? (
                <ScalePressable
                  style={[styles.templateSelectBtn, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                  onPress={() => setTemplatePickerOpen(true)}
                >
                  <View style={[styles.templateIconCircle, { backgroundColor: theme.mint }]}>
                    <Layers size={20} color={theme.emerald} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.templateSelectTitle, { color: theme.ink }]}>Choose Approved Template</Text>
                    <Text style={[styles.templateSelectSubtitle, { color: theme.muted }]}>
                      {templates.length > 0 ? `${templates.length} templates available` : 'Select a WhatsApp template'}
                    </Text>
                  </View>
                  <Text style={[styles.selectAction, { color: theme.emerald }]}>Select ›</Text>
                </ScalePressable>
              ) : (
                <View>
                  <View style={[styles.selectedTemplateHeader, { borderColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedTemplateName, { color: theme.ink }]}>
                        {selectedTemplate.template_name || selectedTemplate.name}
                      </Text>
                      <View style={[styles.categoryPill, { backgroundColor: theme.mint }]}>
                        <Text style={[styles.categoryPillText, { color: theme.emerald }]}>
                          {selectedTemplate.category || 'APPROVED'}
                        </Text>
                      </View>
                    </View>
                    <ScalePressable
                      style={[styles.changeTemplateBtn, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                      onPress={() => setTemplatePickerOpen(true)}
                    >
                      <Text style={[styles.changeTemplateText, { color: theme.emerald }]}>Change</Text>
                    </ScalePressable>
                  </View>

                  {/* Header Media Setting if template has HEADER */}
                  {headerComp && (
                    <View style={styles.headerMediaConfig}>
                      <Text style={[styles.inputLabel, { color: theme.muted }]}>
                        HEADER MEDIA ({headerComp.format})
                      </Text>
                      {headerMediaUrl ? (
                        <View style={[styles.headerMediaBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                          {headerComp.format === 'IMAGE' && headerMediaUrl.startsWith('http') && (
                            <Image source={{ uri: headerMediaUrl }} style={styles.headerThumbnail} />
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.mediaFileName, { color: theme.ink }]} numberOfLines={1}>
                              {uploadedMediaName || 'Header Media'}
                            </Text>
                            <Text style={[styles.mediaFileTag, { color: theme.emerald }]}>
                              {uploadedMediaName.includes('Default') ? '✨ Default template media' : 'Custom media uploaded'}
                            </Text>
                          </View>
                          <ScalePressable
                            onPress={handlePickHeaderMedia}
                            disabled={uploadingMedia}
                            style={[styles.replaceMediaBtn, { backgroundColor: theme.mint }]}
                          >
                            <Text style={[styles.replaceMediaText, { color: theme.emerald }]}>
                              {uploadingMedia ? '...' : 'Replace'}
                            </Text>
                          </ScalePressable>
                        </View>
                      ) : (
                        <ScalePressable
                          onPress={handlePickHeaderMedia}
                          disabled={uploadingMedia}
                          style={[styles.uploadMediaBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                        >
                          <Upload size={18} color={theme.emerald} />
                          <Text style={[styles.uploadMediaText, { color: theme.ink }]}>
                            {uploadingMedia ? 'Uploading...' : 'Upload Header Media'}
                          </Text>
                        </ScalePressable>
                      )}
                    </View>
                  )}

                  {/* Variables Inputs */}
                  {variables.length > 0 && (
                    <View style={styles.variablesSection}>
                      <Text style={[styles.inputLabel, { color: theme.muted, marginBottom: 8 }]}>
                        TEMPLATE VARIABLES
                      </Text>
                      {variables.map((val, idx) => (
                        <View key={idx} style={styles.varRow}>
                          <Text style={[styles.varTag, { color: theme.emerald }]}>{`{{${idx + 1}}}`}</Text>
                          <TextInput
                            value={val}
                            onChangeText={(text) => {
                              const copy = [...variables];
                              copy[idx] = text;
                              setVariables(copy);
                            }}
                            placeholder={`Value for {{${idx + 1}}}`}
                            placeholderTextColor={theme.muted}
                            style={[styles.varInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* WhatsApp Live Preview Card */}
                  <View style={[styles.previewContainer, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                    <Text style={[styles.previewTitle, { color: theme.muted }]}>📱 WHATSAPP MESSAGE PREVIEW</Text>
                    <View style={styles.previewBubble}>
                      {headerMediaUrl && headerComp?.format === 'IMAGE' ? (
                        <Image source={{ uri: headerMediaUrl }} style={styles.previewHeaderImage} resizeMode="cover" />
                      ) : null}
                      <Text style={[styles.previewBody, { color: theme.ink }]}>{previewBodyText}</Text>
                      {footerComp?.text ? (
                        <Text style={[styles.previewFooter, { color: theme.muted }]}>{footerComp.text}</Text>
                      ) : null}
                      {buttonComps.map((btn: any, bIdx: number) => (
                        <View key={bIdx} style={[styles.previewButton, { borderColor: theme.border }]}>
                          <Text style={[styles.previewButtonText, { color: '#0284C7' }]}>{btn.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          </FadeInView>

          {/* Section 3: Audience & Recipients */}
          <FadeInView delay={180} distance={10} duration={300}>
            <Text style={[styles.sectionHeading, { color: theme.ink }]}>3. Target Audience</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Audience Type Switcher */}
              <View style={[styles.audienceSwitcher, { backgroundColor: theme.canvas }]}>
                <Pressable
                  onPress={() => setRecipientMode('manual')}
                  style={[styles.audienceTab, recipientMode === 'manual' && { backgroundColor: theme.surface }]}
                >
                  <Text style={[styles.audienceTabText, { color: recipientMode === 'manual' ? theme.emerald : theme.muted }]}>
                    Numbers
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRecipientMode('contacts');
                    if (contactsList.length === 0) loadContacts();
                  }}
                  style={[styles.audienceTab, recipientMode === 'contacts' && { backgroundColor: theme.surface }]}
                >
                  <Text style={[styles.audienceTabText, { color: recipientMode === 'contacts' ? theme.emerald : theme.muted }]}>
                    Workspace
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRecipientMode('device');
                    if (deviceContactsList.length === 0) loadDeviceContacts();
                  }}
                  style={[styles.audienceTab, recipientMode === 'device' && { backgroundColor: theme.surface }]}
                >
                  <Text style={[styles.audienceTabText, { color: recipientMode === 'device' ? theme.emerald : theme.muted }]}>
                    Contacts
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setRecipientMode('csv')}
                  style={[styles.audienceTab, recipientMode === 'csv' && { backgroundColor: theme.surface }]}
                >
                  <Text style={[styles.audienceTabText, { color: recipientMode === 'csv' ? theme.emerald : theme.muted }]}>
                    CSV
                  </Text>
                </Pressable>
              </View>

              {/* Mode 1: Manual Numbers */}
              {recipientMode === 'manual' && (
                <View style={styles.audienceBody}>
                  <Text style={[styles.inputLabel, { color: theme.muted }]}>
                    ENTER PHONE NUMBERS (COMMA OR NEWLINE SEPARATED)
                  </Text>
                  <TextInput
                    value={manualNumbersText}
                    onChangeText={setManualNumbersText}
                    multiline
                    numberOfLines={4}
                    placeholder="917002695990, 919876543210&#10;+918800112233"
                    placeholderTextColor={theme.muted}
                    style={[styles.textArea, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
                  />
                  <View style={styles.countBadgeRow}>
                    <Users size={14} color={theme.emerald} />
                    <Text style={[styles.countBadgeText, { color: theme.emerald }]}>
                      {parsedManualNumbers.length} valid recipient{parsedManualNumbers.length === 1 ? '' : 's'} detected
                    </Text>
                  </View>
                </View>
              )}

              {/* Mode 2: Select from Workspace Contacts */}
              {recipientMode === 'contacts' && (
                <View style={styles.audienceBody}>
                  <ScalePressable
                    onPress={() => setContactsModalOpen(true)}
                    style={[styles.contactSelectBtn, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                  >
                    <UserCheck size={18} color={theme.emerald} />
                    <Text style={[styles.contactSelectText, { color: theme.ink }]}>
                      {selectedContacts.length > 0
                        ? `${selectedContacts.length} Workspace Contacts Selected`
                        : 'Select from workspace contacts'}
                    </Text>
                    <Text style={[styles.selectAction, { color: theme.emerald }]}>Choose ›</Text>
                  </ScalePressable>
                  {selectedContacts.length > 0 && (
                    <View style={styles.countBadgeRow}>
                      <Users size={14} color={theme.emerald} />
                      <Text style={[styles.countBadgeText, { color: theme.emerald }]}>
                        {selectedContacts.length} recipient{selectedContacts.length === 1 ? '' : 's'} selected from workspace
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Mode 3: Select from Device / SIM Contacts */}
              {recipientMode === 'device' && (
                <View style={styles.audienceBody}>
                  <ScalePressable
                    onPress={() => {
                      setDeviceContactsModalOpen(true);
                      if (deviceContactsList.length === 0) loadDeviceContacts();
                    }}
                    style={[styles.contactSelectBtn, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                  >
                    <Smartphone size={18} color={theme.emerald} />
                    <Text style={[styles.contactSelectText, { color: theme.ink }]}>
                      {selectedDeviceContacts.length > 0
                        ? `${selectedDeviceContacts.length} Device & SIM Contacts Selected`
                        : 'Import from Phone / SIM Contacts'}
                    </Text>
                    <Text style={[styles.selectAction, { color: theme.emerald }]}>Choose ›</Text>
                  </ScalePressable>
                  {selectedDeviceContacts.length > 0 && (
                    <View style={styles.countBadgeRow}>
                      <Users size={14} color={theme.emerald} />
                      <Text style={[styles.countBadgeText, { color: theme.emerald }]}>
                        {selectedDeviceContacts.length} recipient{selectedDeviceContacts.length === 1 ? '' : 's'} selected from device / SIM
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Mode 4: Upload CSV */}
              {recipientMode === 'csv' && (
                <View style={styles.audienceBody}>
                  {csvFileUrl ? (
                    <View style={[styles.uploadedRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                      <FileSpreadsheet size={24} color={theme.emerald} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.mediaFileName, { color: theme.ink }]} numberOfLines={1}>
                          {csvFileName || 'recipients.csv'}
                        </Text>
                        <Text style={[styles.mediaFileTag, { color: theme.emerald }]}>Audience file ready</Text>
                      </View>
                      <ScalePressable onPress={() => { setCsvFileUrl(''); setCsvFileName(''); }} hitSlop={8}>
                        <X size={18} color={theme.muted} />
                      </ScalePressable>
                    </View>
                  ) : (
                    <ScalePressable
                      onPress={handlePickCsv}
                      disabled={uploadingCsv}
                      style={[styles.uploadMediaBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                    >
                      <Upload size={18} color={theme.emerald} />
                      <Text style={[styles.uploadMediaText, { color: theme.ink }]}>
                        {uploadingCsv ? 'Uploading...' : 'Upload Recipients CSV / Excel'}
                      </Text>
                    </ScalePressable>
                  )}
                </View>
              )}
            </View>
          </FadeInView>

          {/* Section 4: Schedule / Dispatch Settings */}
          <FadeInView delay={220} distance={10} duration={300}>
            <Text style={[styles.sectionHeading, { color: theme.ink }]}>4. Delivery Schedule</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.scheduleRow}>
                <Pressable
                  onPress={() => setSendType('immediate')}
                  style={[
                    styles.scheduleOption,
                    sendType === 'immediate' && { backgroundColor: theme.mint, borderColor: theme.emerald },
                    { borderColor: theme.border },
                  ]}
                >
                  <Send size={18} color={sendType === 'immediate' ? theme.emerald : theme.muted} />
                  <Text style={[styles.scheduleOptionText, { color: sendType === 'immediate' ? theme.emerald : theme.ink }]}>
                    Send Immediately
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSendType('scheduled')}
                  style={[
                    styles.scheduleOption,
                    sendType === 'scheduled' && { backgroundColor: theme.mint, borderColor: theme.emerald },
                    { borderColor: theme.border },
                  ]}
                >
                  <Clock size={18} color={sendType === 'scheduled' ? theme.emerald : theme.muted} />
                  <Text style={[styles.scheduleOptionText, { color: sendType === 'scheduled' ? theme.emerald : theme.ink }]}>
                    Schedule Later
                  </Text>
                </Pressable>
              </View>

              {sendType === 'scheduled' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.inputLabel, { color: theme.muted }]}>SCHEDULE TIME (YYYY-MM-DD HH:MM)</Text>
                  <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                    <Calendar size={18} color={theme.muted} />
                    <TextInput
                      value={scheduleTime}
                      onChangeText={setScheduleTime}
                      placeholder="e.g. 2026-08-20 10:00:00"
                      placeholderTextColor={theme.muted}
                      style={[styles.input, { color: theme.ink }]}
                    />
                  </View>
                </View>
              )}
            </View>
          </FadeInView>

          {/* Launch Button */}
          <ScalePressable
            accessibilityRole="button"
            disabled={creating}
            onPress={handleCreate}
            style={[
              styles.launchBtn,
              { backgroundColor: theme.emerald, shadowColor: theme.emeraldDark },
              creating && { opacity: 0.7 },
            ]}
          >
            {creating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Send size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.launchBtnText}>
                  {sendType === 'immediate' ? 'Launch Campaign' : 'Schedule Campaign'}
                </Text>
              </>
            )}
          </ScalePressable>
        </ScrollView>
      </KeyboardAvoidView>

      {/* Template Picker Slide-Up Modal */}
      <SlideUpModal
        visible={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        maxHeight="90%"
        contentStyle={{ height: '82%' }}
      >
        <View style={[styles.modalInner, { backgroundColor: theme.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>Select Approved Template</Text>
            <Pressable onPress={() => setTemplatePickerOpen(false)} hitSlop={8}>
              <X size={22} color={theme.muted} />
            </Pressable>
          </View>

          <View style={[styles.searchBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
            <Search size={18} color={theme.muted} />
            <TextInput
              value={templateSearch}
              onChangeText={setTemplateSearch}
              placeholder="Search templates..."
              placeholderTextColor={theme.muted}
              style={[styles.searchInput, { color: theme.ink }]}
            />
          </View>

          {loadingTemplates ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.emerald} />
            </View>
          ) : (
            <FlatList
              data={filteredTemplates}
              keyExtractor={(item) => String(item.template_id || item.id || item.template_name)}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View style={styles.centerBox}>
                  <Layers size={36} color={theme.border} />
                  <Text style={[styles.emptyModalText, { color: theme.muted }]}>No templates found</Text>
                </View>
              }
              renderItem={({ item }) => (
                <ScalePressable
                  onPress={() => handleSelectTemplate(item)}
                  style={[styles.templateModalItem, { backgroundColor: theme.canvas, borderColor: theme.border }]}
                >
                  <View style={styles.templateModalItemTop}>
                    <Text style={[styles.templateModalItemName, { color: theme.ink }]}>
                      {item.template_name || item.name}
                    </Text>
                    <View style={[styles.categoryPill, { backgroundColor: theme.mint }]}>
                      <Text style={[styles.categoryPillText, { color: theme.emerald }]}>
                        {item.category || 'APPROVED'}
                      </Text>
                    </View>
                  </View>
                  {item.template?.components?.map((c: any, idx: number) => {
                    if (c.type === 'BODY') {
                      return (
                        <Text key={idx} style={[styles.templateModalItemBody, { color: theme.muted }]} numberOfLines={2}>
                          {c.text}
                        </Text>
                      );
                    }
                    return null;
                  })}
                </ScalePressable>
              )}
            />
          )}
        </View>
      </SlideUpModal>

      {/* Contacts Multi-Select Modal */}
      <SlideUpModal
        visible={contactsModalOpen}
        onClose={() => setContactsModalOpen(false)}
        maxHeight="90%"
        contentStyle={{ height: '82%' }}
      >
        <View style={[styles.modalInner, { backgroundColor: theme.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>Select Contacts</Text>
            <Pressable onPress={() => setContactsModalOpen(false)} hitSlop={8}>
              <X size={22} color={theme.muted} />
            </Pressable>
          </View>

          <View style={[styles.searchBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
            <Search size={18} color={theme.muted} />
            <TextInput
              value={contactsSearch}
              onChangeText={setContactsSearch}
              placeholder="Search contacts by name or phone..."
              placeholderTextColor={theme.muted}
              style={[styles.searchInput, { color: theme.ink }]}
            />
          </View>

          {loadingContacts ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.emerald} />
              <Text style={[styles.emptyModalText, { color: theme.muted, marginTop: 10 }]}>Loading contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item, index) => String(item.number || item.phone || item.id || index)}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View style={styles.centerBox}>
                  <Users size={36} color={theme.border} />
                  <Text style={[styles.emptyModalText, { color: theme.muted }]}>
                    {contactsSearch ? 'No matching contacts found' : 'No contacts available in workspace'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const num = String(item.number || item.phone || '');
                const isSelected = selectedContacts.includes(num);
                return (
                  <Pressable
                    onPress={() => {
                      if (isSelected) {
                        setSelectedContacts(selectedContacts.filter((n) => n !== num));
                      } else {
                        setSelectedContacts([...selectedContacts, num]);
                      }
                    }}
                    style={[styles.contactItem, { borderColor: theme.border }]}
                  >
                    <View style={[styles.checkbox, isSelected && { backgroundColor: theme.emerald, borderColor: theme.emerald }, { borderColor: theme.border }]}>
                      {isSelected && <Check size={14} color="#FFF" />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.contactName, { color: theme.ink }]}>{item.name || item.contact_name || 'Unnamed'}</Text>
                      <Text style={[styles.contactNumber, { color: theme.muted }]}>{num}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <ScalePressable
              onPress={() => setContactsModalOpen(false)}
              style={[styles.doneBtn, { backgroundColor: theme.emerald }]}
            >
              <Text style={styles.doneBtnText}>Done ({selectedContacts.length} selected)</Text>
            </ScalePressable>
          </View>
        </View>
      </SlideUpModal>

      {/* Device / SIM Contacts Multi-Select Modal */}
      <SlideUpModal
        visible={deviceContactsModalOpen}
        onClose={() => setDeviceContactsModalOpen(false)}
        maxHeight="92%"
        contentStyle={{ height: '86%' }}
      >
        <View style={[styles.modalInner, { backgroundColor: theme.surface }]}>
          {/* Header row with Select All */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: theme.ink }]}>Device & SIM Contacts</Text>
              {deviceContactsList.length > 0 && (
                <Text style={[{ fontSize: 11, color: theme.muted, marginTop: 2 }]}>
                  {deviceContactsList.length} contacts found
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {deviceContactsList.length > 0 && (
                <ScalePressable onPress={handleToggleSelectAllDeviceContacts} hitSlop={8}>
                  <Text style={[{ fontSize: 12, fontWeight: '700', color: theme.emerald }]}>
                    {filteredDeviceContacts.every((c) => selectedDeviceContacts.includes(c.number))
                      ? 'Deselect All'
                      : 'Select All'}
                  </Text>
                </ScalePressable>
              )}
              <Pressable onPress={() => setDeviceContactsModalOpen(false)} hitSlop={8}>
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>
          </View>

          {/* Search */}
          <View style={[styles.searchBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
            <Search size={18} color={theme.muted} />
            <TextInput
              value={deviceContactsSearch}
              onChangeText={setDeviceContactsSearch}
              placeholder="Search contacts by name or number..."
              placeholderTextColor={theme.muted}
              style={[styles.searchInput, { color: theme.ink }]}
            />
            {deviceContactsSearch.length > 0 && (
              <Pressable onPress={() => setDeviceContactsSearch('')} hitSlop={8}>
                <X size={16} color={theme.muted} />
              </Pressable>
            )}
          </View>

          {/* Permission denied state */}
          {devicePermissionDenied ? (
            <View style={styles.centerBox}>
              <Smartphone size={40} color={theme.border} />
              <Text style={[styles.emptyModalText, { color: theme.muted, marginTop: 12 }]}>
                Contacts permission was denied.
              </Text>
              <ScalePressable
                onPress={loadDeviceContacts}
                style={[styles.doneBtn, { backgroundColor: theme.emerald, marginTop: 16, paddingHorizontal: 24 }]}
              >
                <Text style={styles.doneBtnText}>Grant Permission & Retry</Text>
              </ScalePressable>
            </View>
          ) : loadingDeviceContacts ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.emerald} />
              <Text style={[styles.emptyModalText, { color: theme.muted, marginTop: 10 }]}>
                Loading contacts from device...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredDeviceContacts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              initialNumToRender={30}
              maxToRenderPerBatch={30}
              windowSize={10}
              getItemLayout={(_, index) => ({ length: 54, offset: 54 * index, index })}
              ListEmptyComponent={
                <View style={styles.centerBox}>
                  <Smartphone size={36} color={theme.border} />
                  <Text style={[styles.emptyModalText, { color: theme.muted, marginTop: 10 }]}>
                    {deviceContactsSearch
                      ? 'No matching contacts found'
                      : 'No contacts found on device / SIM'}
                  </Text>
                  {!deviceContactsSearch && (
                    <ScalePressable onPress={loadDeviceContacts} style={{ marginTop: 16 }}>
                      <Text style={[{ fontSize: 13, fontWeight: '700', color: theme.emerald }]}>
                        Retry
                      </Text>
                    </ScalePressable>
                  )}
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedDeviceContacts.includes(item.number);
                return (
                  <Pressable
                    onPress={() => {
                      if (isSelected) {
                        setSelectedDeviceContacts((prev) => prev.filter((n) => n !== item.number));
                      } else {
                        setSelectedDeviceContacts((prev) => [...prev, item.number]);
                      }
                    }}
                    style={[styles.contactItem, { borderColor: theme.border }]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && { backgroundColor: theme.emerald, borderColor: theme.emerald },
                        { borderColor: theme.border },
                      ]}
                    >
                      {isSelected && <Check size={14} color="#FFF" />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.contactName, { color: theme.ink }]}>{item.name}</Text>
                      <Text style={[styles.contactNumber, { color: theme.muted }]}>{item.number}</Text>
                    </View>
                    <Smartphone size={14} color={theme.muted} />
                  </Pressable>
                );
              }}
            />
          )}

          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <ScalePressable
              onPress={() => setDeviceContactsModalOpen(false)}
              style={[styles.doneBtn, { backgroundColor: theme.emerald }]}
            >
              <Text style={styles.doneBtnText}>Done ({selectedDeviceContacts.length} selected)</Text>
            </ScalePressable>
          </View>
        </View>
      </SlideUpModal>
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
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { width: 40 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 15, fontWeight: '800' },
  heroSubtitle: { fontSize: 12, marginTop: 2 },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, height: '100%' },
  templateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  templateIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateSelectTitle: { fontSize: 14, fontWeight: '700' },
  templateSelectSubtitle: { fontSize: 12, marginTop: 2 },
  selectAction: { fontSize: 14, fontWeight: '700' },
  selectedTemplateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  selectedTemplateName: { fontSize: 15, fontWeight: '800' },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  categoryPillText: { fontSize: 10, fontWeight: '800' },
  changeTemplateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeTemplateText: { fontSize: 12, fontWeight: '700' },
  headerMediaConfig: { marginTop: 14 },
  headerMediaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerThumbnail: { width: 44, height: 44, borderRadius: 8 },
  mediaFileName: { fontSize: 13, fontWeight: '700' },
  mediaFileTag: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  replaceMediaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  replaceMediaText: { fontSize: 12, fontWeight: '700' },
  uploadMediaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  uploadMediaText: { fontSize: 13, fontWeight: '700' },
  variablesSection: { marginTop: 14 },
  varRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  varTag: { fontSize: 12, fontWeight: '800', width: 45 },
  varInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  previewContainer: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  previewTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  previewBubble: {
    backgroundColor: '#E7FCE8',
    borderRadius: 12,
    padding: 12,
    borderTopLeftRadius: 0,
  },
  previewHeaderImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  previewBody: { fontSize: 13, lineHeight: 18 },
  previewFooter: { fontSize: 11, marginTop: 6, opacity: 0.8 },
  previewButton: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  previewButtonText: { fontSize: 12, fontWeight: '700' },
  audienceSwitcher: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    marginBottom: 12,
  },
  audienceTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  audienceTabText: { fontSize: 12, fontWeight: '700' },
  audienceBody: { marginTop: 4 },
  textArea: {
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  countBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700' },
  contactSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  contactSelectText: { flex: 1, fontSize: 13, fontWeight: '600' },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  scheduleRow: { flexDirection: 'row', gap: 10 },
  scheduleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  scheduleOptionText: { fontSize: 13, fontWeight: '700' },
  launchBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  launchBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  modalInner: { flex: 1, paddingBottom: 20 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, height: '100%' },
  centerBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyModalText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  templateModalItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  templateModalItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateModalItemName: { fontSize: 14, fontWeight: '700' },
  templateModalItemBody: { fontSize: 12, marginTop: 4 },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactName: { fontSize: 14, fontWeight: '600' },
  contactNumber: { fontSize: 12, marginTop: 2 },
  modalFooter: { padding: 16, borderTopWidth: 1 },
  doneBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
