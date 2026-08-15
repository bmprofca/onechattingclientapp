import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { X, Search, FileText, ArrowLeft, Upload } from 'lucide-react-native';
import {
  pick,
  types as DocumentPickerTypes,
} from '@react-native-documents/picker';
import { ApiSession } from '../api/client';
import { getTemplates, unwrapList } from '../api/workspace';
import { uploadFile } from '../api/upload';
import { useTheme } from '../theme/theme';
import { applyBodyParameters } from '../utils/templateUtils';
import { SlideUpModal, ScalePressable, FadeInView } from './animations';

type TemplateModalProps = {
  visible: boolean;
  onClose: () => void;
  session: ApiSession;
  projectId: string;
  onSelectTemplate: (templateId: string, components: any[]) => void;
};

export function TemplateModal({
  visible,
  onClose,
  session,
  projectId,
  onSelectTemplate,
}: TemplateModalProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    if (visible && projectId && session) {
      loadTemplates();
      setSelectedTemplate(null);
      setVariables([]);
      setHeaderMediaUrl('');
      setUploadedFileName('');
      setUploadingMedia(false);
    }
  }, [visible, projectId, session]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await getTemplates(session, projectId, 'APPROVED');
      const list = unwrapList(res);
      setTemplates(list);
    } catch (err) {
      console.warn('Failed to load templates', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const lower = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.template_name?.toLowerCase().includes(lower) ||
        t.category?.toLowerCase().includes(lower)
    );
  }, [templates, searchQuery]);

  const handleSelect = (template: any) => {
    let hasVariables = false;
    let requiredVars: string[] = [];
    let requiresMedia = false;
    let defaultMedia = '';

    const components = template.template?.components || template.components || [];
    components.forEach((component: any) => {
      if (component.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format)) {
        requiresMedia = true;
        const handle = component.example?.header_handle?.[0] || component.example?.header_url?.[0] || '';
        if (handle) {
          defaultMedia = handle;
        }
      }
      if (component.type === 'BODY' && component.text) {
        const matches = component.text.match(/\{\{\d+\}\}/g);
        if (matches) {
          hasVariables = true;
          matches.forEach((m: string, idx: number) => {
            const ex = component.example?.body_text?.[0]?.[idx] || `Variable ${idx + 1}`;
            requiredVars.push(ex);
          });
        }
      }
    });

    if (hasVariables || requiresMedia) {
      setSelectedTemplate(template);
      setVariables(requiredVars);
      setHeaderMediaUrl(defaultMedia);
      setUploadedFileName(defaultMedia ? 'Default Template Media' : '');
    } else {
      submitTemplate(template, [], defaultMedia);
    }
  };

  const handlePickHeaderMedia = async () => {
    try {
      const [result] = await pick({
        type: [DocumentPickerTypes.images, DocumentPickerTypes.pdf, DocumentPickerTypes.video, DocumentPickerTypes.allFiles],
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
        setUploadedFileName(uploaded.meta?.originalName || result.name || 'Custom Media');
      } else {
        console.warn('Upload failed', uploaded);
      }
    } catch (err: any) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.warn('Pick/upload error', err);
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  const submitTemplate = (template: any, currentVars: string[], mediaUrl: string) => {
    const formattedComponents: any[] = [];
    const components = template.template?.components || template.components || [];

    components.forEach((component: any) => {
      if (component.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format)) {
        const effectiveMedia = mediaUrl || component.example?.header_handle?.[0] || component.example?.header_url?.[0] || '';
        if (effectiveMedia) {
          formattedComponents.push({
            type: 'header',
            parameters: [
              {
                type: component.format.toLowerCase(),
                [component.format.toLowerCase()]: { link: effectiveMedia }
              }
            ]
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
              text: currentVars[idx] || '',
            });
          });
        }
        formattedComponents.push({
          type: 'body',
          parameters,
        });
      }
    });

    onSelectTemplate(template.template_id || template.id, formattedComponents);
    setSelectedTemplate(null);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    return (
      <FadeInView delay={Math.min(index * 40, 300)} distance={12}>
        <ScalePressable
          style={[
            styles.templateCard,
            { backgroundColor: theme.canvas, borderColor: theme.border },
          ]}
          onPress={() => handleSelect(item)}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.templateName, { color: theme.ink }]} numberOfLines={1}>
              {item.template_name}
            </Text>
            <View style={[styles.categoryBadge, { backgroundColor: theme.mint }]}>
              <Text style={[styles.categoryText, { color: theme.mintText }]}>
                {item.category || 'MARKETING'}
              </Text>
            </View>
          </View>
          
          {item.template?.components?.map((comp: any, idx: number) => {
            if (comp.type === 'BODY') {
              return (
                <Text key={idx} style={[styles.templateBody, { color: theme.muted }]} numberOfLines={3}>
                  {comp.text}
                </Text>
              );
            }
            return null;
          })}
        </ScalePressable>
      </FadeInView>
    );
  };

  const renderEditView = () => {
    if (!selectedTemplate) return null;

    const components = selectedTemplate.template?.components || [];
    const bodyComponent = components.find((c: any) => c.type === 'BODY');
    const headerComponent = components.find((c: any) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));

    const previewParams = variables.map(v => ({ text: v }));
    const previewText = bodyComponent ? applyBodyParameters(bodyComponent.text, previewParams) : '';

    return (
      <FadeInView duration={250} distance={10} style={styles.editContainer}>
        <View style={[styles.previewBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
          <Text style={[styles.previewLabel, { color: theme.muted }]}>Preview</Text>
          <Text style={[styles.previewText, { color: theme.ink }]}>{previewText}</Text>
        </View>
        
        <ScrollView style={styles.editScroll} contentContainerStyle={{ padding: 16 }}>
          {headerComponent && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.ink }]}>Header Media ({headerComponent.format})</Text>
              {headerMediaUrl ? (
                <View style={[styles.uploadedRow, { backgroundColor: theme.canvas, borderColor: theme.border, alignItems: 'center' }]}>
                  {headerComponent.format === 'IMAGE' && headerMediaUrl.startsWith('http') && (
                    <Image source={{ uri: headerMediaUrl }} style={{ width: 42, height: 42, borderRadius: 8, marginRight: 10 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.uploadedFileName, { color: theme.ink }]} numberOfLines={1}>
                      {uploadedFileName || 'Media attached'}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.emerald, fontWeight: '600' }}>
                      {uploadedFileName?.includes('Default') ? 'Default template media' : 'Ready to send'}
                    </Text>
                  </View>
                  <ScalePressable
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.mint, marginRight: 6 }}
                    onPress={handlePickHeaderMedia}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.emerald }}>Replace</Text>
                  </ScalePressable>
                  <ScalePressable onPress={() => { setHeaderMediaUrl(''); setUploadedFileName(''); }} hitSlop={8}>
                    <X size={18} color={theme.muted} />
                  </ScalePressable>
                </View>
              ) : uploadingMedia ? (
                <View style={[styles.uploadingRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <ActivityIndicator size="small" color={theme.emerald} />
                  <Text style={[styles.uploadingText, { color: theme.muted }]}>Uploading...</Text>
                </View>
              ) : (
                <ScalePressable
                  style={[styles.uploadBtn, { backgroundColor: theme.emerald }]}
                  onPress={handlePickHeaderMedia}
                >
                  <Upload size={18} color="#FFF" />
                  <Text style={styles.uploadBtnText}>Choose File</Text>
                </ScalePressable>
              )}
            </View>
          )}

          {variables.map((val, idx) => (
            <View key={idx} style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.ink }]}>Variable {`{{${idx + 1}}}`}</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: theme.canvas, borderColor: theme.border, color: theme.ink }]}
                value={val}
                onChangeText={(text) => {
                  const newVars = [...variables];
                  newVars[idx] = text;
                  setVariables(newVars);
                }}
              />
            </View>
          ))}
        </ScrollView>

        <View style={[styles.editFooter, { borderTopColor: theme.border }]}>
          <ScalePressable
            style={[styles.sendBtn, { backgroundColor: theme.emerald }]}
            onPress={() => submitTemplate(selectedTemplate, variables, headerMediaUrl)}
          >
            <Text style={styles.sendBtnText}>Send Template</Text>
          </ScalePressable>
        </View>
      </FadeInView>
    );
  };

  return (
    <SlideUpModal
      visible={visible}
      onClose={onClose}
      maxHeight="92%"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalContent, { backgroundColor: theme.surface }]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          {selectedTemplate ? (
            <ScalePressable onPress={() => setSelectedTemplate(null)} hitSlop={8} style={{ marginRight: 12 }}>
              <ArrowLeft size={24} color={theme.ink} />
            </ScalePressable>
          ) : null}
          <Text style={[styles.title, { color: theme.ink, flex: 1 }]}>
            {selectedTemplate ? 'Edit Template' : 'Select Template'}
          </Text>
          <ScalePressable onPress={onClose} hitSlop={8}>
            <X size={24} color={theme.muted} />
          </ScalePressable>
        </View>

        {!selectedTemplate ? (
          <>
            <View style={[styles.searchContainer, { borderBottomColor: theme.border }]}>
              <View style={[styles.searchBar, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                <Search size={18} color={theme.muted} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: theme.ink }]}
                  placeholder="Search templates..."
                  placeholderTextColor={theme.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.emerald} />
                <Text style={[styles.loadingText, { color: theme.muted }]}>
                  Loading templates...
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredTemplates}
                keyExtractor={(item) => String(item.id || item.template_id || item.name)}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.centerContainer}>
                    <FileText size={48} color={theme.border} />
                    <Text style={[styles.emptyText, { color: theme.muted }]}>
                      No templates found
                    </Text>
                  </View>
                }
              />
            )}
          </>
        ) : (
          renderEditView()
        )}
      </KeyboardAvoidingView>
    </SlideUpModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  listContent: {
    padding: 12,
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
  },
  templateBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  editContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  previewBox: {
    margin: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  editScroll: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  editFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  sendBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  uploadBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 14,
    marginRight: 8,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  uploadingText: {
    fontSize: 14,
  },
});
