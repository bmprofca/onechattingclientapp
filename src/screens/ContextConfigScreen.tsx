import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import { ArrowLeft, Save, Plus, Trash2, X, FileText, Type, HelpCircle, Info, UploadCloud, ChevronDown, ChevronUp } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types as DocumentPickerTypes,
} from '@react-native-documents/picker';
import { useTheme } from '../theme/theme';
import { ApiSession } from '../api/client';
import { getBotSettings, updateBotSettings } from '../api/context';
import { uploadFile } from '../api/upload';
import { ScalePressable, FadeInView, SlideUpModal } from '../components/animations';

// Types
type SectionType = 'qa' | 'info' | 'text' | 'docs';
type Item = {
  id: string;
  // Common
  label?: string;
  // QA
  question?: string;
  answer?: string;
  // Info
  value?: string;
  // Text
  content?: string;
  // Docs
  url?: string;
  fileName?: string;
  fileType?: string;
};
type Section = {
  id: string;
  title: string;
  type: SectionType;
  items: Item[];
  collapsed?: boolean;
};
type BotSettings = {
  autoReplyStatus: boolean;
  provider: string;
  model: string;
};

const SECTION_TYPES = [
  { id: 'qa', label: 'Q&A (Frequently Asked)', icon: HelpCircle },
  { id: 'info', label: 'Information (Key-Value)', icon: Info },
  { id: 'text', label: 'Paragraphs (General Text)', icon: Type },
  { id: 'docs', label: 'Documents (PDF/Excel)', icon: FileText },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptyItem = (type: SectionType): Item => {
  const id = generateId();
  switch (type) {
    case 'qa': return { id, question: '', answer: '' };
    case 'info': return { id, label: '', value: '' };
    case 'text': return { id, content: '' };
    case 'docs': return { id, label: '', url: '', fileName: '', fileType: '' };
    default: return { id };
  }
};

const isSectionType = (value: unknown): value is SectionType =>
  value === 'qa' || value === 'info' || value === 'text' || value === 'docs';

// Context saved by older web versions may not contain client-side IDs. Add
// them while loading so list edits and removals are always reliable.
const normalizeSection = (value: unknown): Section | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<Section>;
  if (!isSectionType(source.type)) return null;
  const items = Array.isArray(source.items) ? source.items : [];
  return {
    id: source.id || generateId(),
    title: typeof source.title === 'string' ? source.title : 'Untitled Section',
    type: source.type,
    items: items.map(item => ({ ...(item && typeof item === 'object' ? item : {}), id: (item as Item)?.id || generateId() })),
    collapsed: false,
  };
};

export function ContextConfigScreen({
  projectId,
  session,
  onBack,
}: {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
}) {
  const theme = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [botSettings, setBotSettings] = useState<BotSettings>({
    autoReplyStatus: false,
    provider: 'gemini',
    model: 'gemini-1.5-flash',
  });
  
  const [showTypeModal, setShowTypeModal] = useState(false);
  // When set, the type modal is being used to CHANGE an existing section's
  // type rather than create a brand new section.
  const [changeTypeSectionId, setChangeTypeSectionId] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Load context
  useEffect(() => {
    let mounted = true;
    getBotSettings(session, projectId)
      .then(res => {
        if (!mounted) return;
        const data = res.data || res;
        if (data) {
          setBotSettings({
            autoReplyStatus: !!data.auto_reply_status,
            provider: data.ai_provider || 'gemini',
            model: data.ai_model || 'gemini-1.5-flash',
          });
          if (data.context) {
            try {
              const parsed: unknown = typeof data.context === 'string' ? JSON.parse(data.context) : data.context;
              const rawSections = parsed && typeof parsed === 'object' ? (parsed as { sections?: unknown }).sections : undefined;
              if (Array.isArray(rawSections)) {
                setSections(rawSections.map(normalizeSection).filter((section): section is Section => section !== null));
              }
            } catch (e) {
              console.log('Context parsing error', e);
            }
          }
        }
      })
      .catch(err => {
        if (!mounted) return;
        Toast.show({ type: 'error', text1: 'Failed to load context', text2: err.message });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [projectId, session]);

  const handleSave = async () => {
    // Validate empty required fields
    for (const section of sections) {
      if (!section.title.trim()) {
        Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Section titles cannot be empty' });
        return;
      }
      for (const item of section.items) {
        if (section.type === 'qa' && (!item.question?.trim() || !item.answer?.trim())) {
          Toast.show({ type: 'error', text1: 'Validation Error', text2: `Complete all Q&A fields in "${section.title}"` });
          return;
        }
        if (section.type === 'info' && (!item.label?.trim() || !item.value?.trim())) {
          Toast.show({ type: 'error', text1: 'Validation Error', text2: `Complete all Info fields in "${section.title}"` });
          return;
        }
        if (section.type === 'text' && !item.content?.trim()) {
          Toast.show({ type: 'error', text1: 'Validation Error', text2: `Complete all text content in "${section.title}"` });
          return;
        }
        if (section.type === 'docs' && !item.url) {
          Toast.show({ type: 'error', text1: 'Validation Error', text2: `Upload files for all document entries in "${section.title}"` });
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Strip UI-only fields (collapsed) before persisting
      const cleanSections = sections.map(({ collapsed, ...rest }) => rest);
      await updateBotSettings(session, projectId, {
        auto_reply_status: botSettings.autoReplyStatus ? 1 : 0,
        ai_provider: botSettings.provider,
        ai_model: botSettings.model,
        context: JSON.stringify({ sections: cleanSections }),
      });
      Toast.show({ type: 'success', text1: 'Saved', text2: 'Company context saved successfully' });
      onBack();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addSection = (typeId: string) => {
    const typeDef = SECTION_TYPES.find(t => t.id === typeId);
    if (!typeDef) return;
    
    const newSection: Section = {
      id: generateId(),
      title: 'New Section',
      type: typeId as SectionType,
      items: [createEmptyItem(typeId as SectionType)],
      collapsed: false,
    };
    
    setSections(current => [...current, newSection]);
    setShowTypeModal(false);
  };

  const removeSection = (sectionId: string) => {
    Alert.alert('Delete Section', 'Are you sure you want to delete this entire section?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
          setSections(current => current.filter(s => s.id !== sectionId));
        }
      }
    ]);
  };

  // Opens the type picker in "change type" mode for an existing section.
  const openChangeType = (sectionId: string) => {
    setChangeTypeSectionId(sectionId);
    setShowTypeModal(true);
  };

  // Changing a section's type resets its items to a single empty item of
  // the new type, mirroring the web behavior.
  const changeSectionType = (sectionId: string, typeId: string) => {
    setSections(current => current.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, type: typeId as SectionType, items: [createEmptyItem(typeId as SectionType)] };
    }));
    setShowTypeModal(false);
    setChangeTypeSectionId(null);
  };

  const handleTypeModalSelect = (typeId: string) => {
    if (changeTypeSectionId) {
      changeSectionType(changeTypeSectionId, typeId);
    } else {
      addSection(typeId);
    }
  };

  const closeTypeModal = () => {
    setShowTypeModal(false);
    setChangeTypeSectionId(null);
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setSections(current => current.map(s => (s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s)));
  };

  const addItem = (sectionId: string, type: SectionType) => {
    setSections(current => current.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, items: [...s.items, createEmptyItem(type)] };
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setSections(current => current.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, items: s.items.filter(i => i.id !== itemId) };
    }));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(current => current.map(s => (s.id === sectionId ? { ...s, title } : s)));
  };

  const updateItemField = (sectionId: string, itemId: string, field: keyof Item, value: string) => {
    setSections(current => current.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        items: s.items.map(i => (i.id === itemId ? { ...i, [field]: value } : i)),
      };
    }));
  };

  const handleDocumentPick = async (sectionId: string, itemId: string) => {
    try {
      const [result] = await pick({
        type: [DocumentPickerTypes.pdf, DocumentPickerTypes.csv, DocumentPickerTypes.xls, DocumentPickerTypes.xlsx],
        presentationStyle: 'fullScreen',
      });

      if (!result.uri || !result.name) return;
      if (result.size && result.size > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Maximum file size is 10MB.');
        return;
      }

      setUploadingDocId(itemId);
      
      const file = {
        uri: result.uri,
        name: result.name,
        type: result.type || 'application/octet-stream',
      };

      const uploadResult = await uploadFile(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      setSections(current => current.map(section => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          items: section.items.map(item => item.id === itemId ? {
            ...item,
            url: uploadResult.url,
            fileName: file.name,
            fileType: ext,
            label: item.label?.trim() ? item.label : file.name,
          } : item),
        };
      }));
      
      Toast.show({ type: 'success', text1: 'Document uploaded' });
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return; // User cancelled
      }
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err.message });
    } finally {
      setUploadingDocId(null);
    }
  };

  const renderSectionContent = (section: Section, item: Item, index: number) => {
    switch (section.type) {
      case 'qa':
        return (
          <View style={styles.itemRow}>
            <Text style={[styles.itemIndex, { color: theme.muted }]}>{index + 1}.</Text>
            <View style={styles.itemInputs}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface }]}
                placeholder="Question (e.g. What are your hours?)"
                placeholderTextColor={theme.muted}
                value={item.question}
                onChangeText={v => updateItemField(section.id, item.id, 'question', v)}
              />
              <TextInput
                style={[styles.textArea, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface }]}
                placeholder="Answer (e.g. 9AM to 5PM)"
                placeholderTextColor={theme.muted}
                multiline
                value={item.answer}
                onChangeText={v => updateItemField(section.id, item.id, 'answer', v)}
              />
            </View>
          </View>
        );
      case 'info':
        return (
          <View style={styles.itemRow}>
            <Text style={[styles.itemIndex, { color: theme.muted }]}>{index + 1}.</Text>
            <View style={[styles.itemInputs, { flexDirection: 'row', gap: 8 }]}>
              <TextInput
                style={[styles.input, { flex: 1, borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface }]}
                placeholder="Label (e.g. Email)"
                placeholderTextColor={theme.muted}
                value={item.label}
                onChangeText={v => updateItemField(section.id, item.id, 'label', v)}
              />
              <TextInput
                style={[styles.input, { flex: 2, borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface }]}
                placeholder="Value (e.g. hello@example.com)"
                placeholderTextColor={theme.muted}
                value={item.value}
                onChangeText={v => updateItemField(section.id, item.id, 'value', v)}
              />
            </View>
          </View>
        );
      case 'text':
        return (
          <View style={styles.itemRow}>
            <Text style={[styles.itemIndex, { color: theme.muted }]}>{index + 1}.</Text>
            <View style={styles.itemInputs}>
              <TextInput
                style={[styles.textArea, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface }]}
                placeholder="Write your policy or background information here..."
                placeholderTextColor={theme.muted}
                multiline
                value={item.content}
                onChangeText={v => updateItemField(section.id, item.id, 'content', v)}
              />
            </View>
          </View>
        );
      case 'docs':
        return (
          <View style={styles.itemRow}>
            <Text style={[styles.itemIndex, { color: theme.muted }]}>{index + 1}.</Text>
            <View style={styles.itemInputs}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.ink, backgroundColor: theme.surface }]}
                placeholder="Document Label (e.g. Product Catalog 2024)"
                placeholderTextColor={theme.muted}
                value={item.label}
                onChangeText={v => updateItemField(section.id, item.id, 'label', v)}
              />
              {item.url ? (
                <View style={[styles.docPreview, { backgroundColor: theme.cardHover, borderColor: theme.border }]}>
                  <View style={styles.docPreviewHeader}>
                    <FileText size={20} color={theme.mint} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docPreviewName, { color: theme.ink }]} numberOfLines={1}>{item.fileName}</Text>
                      <Text style={[styles.docPreviewType, { color: theme.muted }]}>{item.fileType?.toUpperCase()} • URL Available</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      updateItemField(section.id, item.id, 'url', '');
                      updateItemField(section.id, item.id, 'fileName', '');
                    }}
                    style={styles.removeDocBtn}
                  >
                    <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '600' }}>Remove File</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.canvas }]}
                  onPress={() => handleDocumentPick(section.id, item.id)}
                  disabled={uploadingDocId === item.id}
                >
                  {uploadingDocId === item.id ? (
                    <ActivityIndicator color={theme.mint} size="small" />
                  ) : (
                    <>
                      <UploadCloud size={24} color={theme.muted} style={{ marginBottom: 8 }} />
                      <Text style={{ color: theme.ink, fontWeight: '600', fontSize: 14 }}>Tap to Upload Document</Text>
                      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>PDF, Excel, or CSV (Max 10MB)</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
            <ArrowLeft size={24} color={theme.ink} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>AI Context & Setup</Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={[styles.saveBtn, { backgroundColor: theme.mint }, (saving || loading) && { opacity: 0.6 }]}
        >
          {saving ? (
            <ActivityIndicator color={theme.mintText} size="small" />
          ) : (
            <>
              <Save size={16} color={theme.mintText} />
              <Text style={[styles.saveBtnText, { color: theme.mintText }]}>Save</Text>
            </>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.mint} />
        </View>
      ) : (
        <KeyboardAvoidView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.description, { color: theme.muted }]}>
              Train your AI agent by adding information about your company. The AI will use this knowledge to answer customer queries accurately.
            </Text>

            {sections.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <HelpCircle size={40} color={theme.muted} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: theme.ink }]}>No Context Added Yet</Text>
                <Text style={[styles.emptyDesc, { color: theme.muted }]}>Start by adding a section below to train your AI.</Text>
              </View>
            ) : (
              sections.map((section) => {
                const typeDef = SECTION_TYPES.find(t => t.id === section.type) || SECTION_TYPES[0];
                const TypeIcon = typeDef.icon;
                return (
                  <View key={section.id} style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
                      <View style={[styles.typeIconBg, { backgroundColor: theme.canvas }]}>
                        <TypeIcon size={16} color={theme.mint} />
                      </View>
                      <TextInput
                        style={[styles.sectionTitleInput, { color: theme.ink }]}
                        value={section.title}
                        onChangeText={v => updateSectionTitle(section.id, v)}
                        placeholder="Section Title (e.g. Business Hours)"
                        placeholderTextColor={theme.muted}
                      />
                      <Pressable
                        style={[styles.sectionTypeSelect, { borderColor: theme.border }]}
                        onPress={() => openChangeType(section.id)}
                      >
                        <Text style={[styles.sectionBadgeText, { color: theme.ink }]}>{typeDef.label.split(' (')[0]}</Text>
                        <ChevronDown size={14} color={theme.muted} />
                      </Pressable>
                      <Pressable onPress={() => toggleSectionCollapse(section.id)} hitSlop={8} style={{ padding: 2 }}>
                        {section.collapsed ? (
                          <ChevronDown size={18} color={theme.muted} />
                        ) : (
                          <ChevronUp size={18} color={theme.muted} />
                        )}
                      </Pressable>
                      <Pressable onPress={() => removeSection(section.id)} hitSlop={8}>
                        <Trash2 size={18} color={theme.danger} />
                      </Pressable>
                    </View>

                    {!section.collapsed && (
                      <View style={styles.sectionBody}>
                        {section.items.map((item, index) => (
                          <View key={item.id} style={styles.itemWrapper}>
                            {renderSectionContent(section, item, index)}
                            {section.items.length > 1 && (
                              <Pressable
                                onPress={() => removeItem(section.id, item.id)}
                                style={styles.removeItemBtn}
                                hitSlop={8}
                              >
                                <X size={16} color={theme.danger} />
                              </Pressable>
                            )}
                          </View>
                        ))}

                        <Pressable
                          style={[styles.addItemBtn, { borderColor: theme.mint }]}
                          onPress={() => addItem(section.id, section.type)}
                        >
                          <Plus size={16} color={theme.mint} />
                          <Text style={[styles.addItemText, { color: theme.mint }]}>Add Another Item</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            <ScalePressable
              style={[styles.addSectionBtn, { backgroundColor: theme.mint }]}
              onPress={() => { setChangeTypeSectionId(null); setShowTypeModal(true); }}
            >
              <Plus size={20} color={theme.mintText} />
              <Text style={[styles.addSectionBtnText, { color: theme.mintText }]}>Add New Section</Text>
            </ScalePressable>
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidView>
      )}

      {/* Type Selection / Change Modal */}
      <SlideUpModal visible={showTypeModal} onClose={closeTypeModal} maxHeight="65%">
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>
              {changeTypeSectionId ? 'Change Section Type' : 'Choose Section Type'}
            </Text>
            <ScalePressable onPress={closeTypeModal} hitSlop={8}><X size={24} color={theme.muted} /></ScalePressable>
          </View>
          {changeTypeSectionId && (
            <Text style={[styles.modalWarning, { color: theme.muted }]}>
              Changing the type will reset this section's items.
            </Text>
          )}
          <View style={styles.typeList}>
            {SECTION_TYPES.map(type => (
              <ScalePressable
                key={type.id}
                style={[styles.typeOption, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={() => handleTypeModalSelect(type.id)}
              >
                <View style={[styles.typeIconBg, { backgroundColor: theme.canvas }]}>
                  <type.icon size={20} color={theme.mint} />
                </View>
                <Text style={[styles.typeOptionText, { color: theme.ink }]}>{type.label}</Text>
              </ScalePressable>
            ))}
          </View>
        </View>
      </SlideUpModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: { fontWeight: '700', fontSize: 14 },
  scrollContent: { padding: 16 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  
  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyDesc: { fontSize: 14, textAlign: 'center' },
  
  section: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  sectionTitleInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    padding: 0,
  },
  sectionTypeSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700' },
  
  sectionBody: { padding: 12 },
  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemRow: { flex: 1, flexDirection: 'row', gap: 8 },
  itemIndex: { fontSize: 14, fontWeight: '600', marginTop: 10, width: 20 },
  itemInputs: { flex: 1, gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  removeItemBtn: { padding: 8, marginTop: 4, marginLeft: 4 },
  
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
  },
  addItemText: { fontWeight: '600', fontSize: 14 },
  
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addSectionBtnText: { fontWeight: '700', fontSize: 15 },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalWarning: { fontSize: 12, marginBottom: 16 },
  typeList: { gap: 12 },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  typeIconBg: {
    padding: 8,
    borderRadius: 8,
  },
  typeOptionText: { fontSize: 15, fontWeight: '600' },

  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPreview: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  docPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  docPreviewName: { fontSize: 14, fontWeight: '600' },
  docPreviewType: { fontSize: 12, marginTop: 2 },
  removeDocBtn: {
    alignSelf: 'flex-start',
  },
});