import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { X, Sparkles, Check, CheckCircle, MessageSquare, Info } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ApiSession } from '../api/client';
import { generateAiTemplate, createTemplate } from '../api/workspace';
import { useTheme } from '../theme/theme';
import { KeyboardAvoidView } from './KeyboardAvoidView';

type AiTemplateModalProps = {
  visible: boolean;
  onClose: () => void;
  session: ApiSession;
  projectId: string;
  onApplyTemplate: (aiData: any) => void;
  onSavedDirectly?: () => void;
};

const QUICK_PROMPTS = [
  {
    label: '🔥 50% Flash Sale',
    prompt: 'Limited time 50% weekend sale on shoes with promo code and shop link',
    category: 'MARKETING',
    tone: 'exciting and promotional',
    button_type: 'QUICK_REPLY',
  },
  {
    label: '📦 Order Shipped',
    prompt: 'Order dispatch update with tracking number, courier partner, and track order button',
    category: 'UTILITY',
    tone: 'informative and polite',
    button_type: 'URL',
  },
  {
    label: '💳 Payment Due',
    prompt: 'Gentle reminder for pending invoice payment with invoice number, due date, and pay now link',
    category: 'UTILITY',
    tone: 'polite and professional',
    button_type: 'URL',
  },
  {
    label: '🎉 Welcome Offer',
    prompt: 'Warm welcome message for new users offering a 20% first purchase discount code',
    category: 'MARKETING',
    tone: 'friendly and welcoming',
    button_type: 'URL',
  },
];

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const TONES = [
  { label: 'Friendly', value: 'friendly and persuasive' },
  { label: 'Promotional', value: 'exciting and promotional' },
  { label: 'Professional', value: 'polite and professional' },
];
const LANGUAGES = ['en', 'hi', 'es', 'fr', 'de', 'ar'];
const HEADER_TYPES = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'];
const AI_BUTTON_TYPES = ['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER'];

export function AiTemplateModal({
  visible,
  onClose,
  session,
  projectId,
  onApplyTemplate,
  onSavedDirectly,
}: AiTemplateModalProps) {
  const theme = useTheme();
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en');
  const [tone, setTone] = useState('friendly and persuasive');
  const [buttonType, setButtonType] = useState('QUICK_REPLY');
  const [headerType, setHeaderType] = useState('NONE');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [savingDirectly, setSavingDirectly] = useState(false);
  const [generatedData, setGeneratedData] = useState<any | null>(null);

  const handleSelectQuickPrompt = (item: any) => {
    setPrompt(item.prompt);
    if (item.category) setCategory(item.category);
    if (item.tone) setTone(item.tone);
    if (item.button_type) setButtonType(item.button_type);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter a description or use-case' });
      return;
    }

    setLoading(true);
    setGeneratedData(null);

    try {
      const response = await generateAiTemplate(session, projectId, {
        prompt: prompt.trim(),
        category,
        language,
        tone,
        header_type: headerType,
        button_type: buttonType,
        custom_instructions: customInstructions.trim(),
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      if (response?.data?.template) {
        setGeneratedData(response.data);
        Toast.show({ type: 'success', text1: '✨ Template generated with AI!' });
      } else {
        throw new Error('Could not generate template');
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'AI Generation Failed',
        text2: err?.message || 'Please check platform AI key in DB',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedData) return;
    onApplyTemplate(generatedData);
    Toast.show({ type: 'success', text1: 'Applied to template editor — you can keep editing it there' });
    onClose();
  };

  const handleSaveDirectly = async () => {
    if (!generatedData?.template) return;
    setSavingDirectly(true);

    try {
      const response = await createTemplate(session, projectId, generatedData.template);
      if (response?.error) {
        throw new Error(response.error);
      }

      Toast.show({ type: 'success', text1: 'Template submitted & saved!' });
      if (onSavedDirectly) {
        onSavedDirectly();
      }
      onClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not save template',
        text2: err?.message || 'Meta template validation failed',
      });
    } finally {
      setSavingDirectly(false);
    }
  };

  const comps = generatedData?.template?.components || [];
  const bodyComp = comps.find((c: any) => String(c.type).toUpperCase() === 'BODY');
  const headerComp = comps.find((c: any) => String(c.type).toUpperCase() === 'HEADER');
  const footerComp = comps.find((c: any) => String(c.type).toUpperCase() === 'FOOTER');
  const buttonsComp = comps.find((c: any) => String(c.type).toUpperCase() === 'BUTTONS');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidView style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.canvas }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.sparkleIcon, { backgroundColor: theme.emerald + '20' }]}>
                <Sparkles size={20} color={theme.emerald} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.ink }]}>AI Template Generator</Text>
                <Text style={[styles.subtitle, { color: theme.muted }]}>Build WhatsApp templates instantly</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Quick Suggestions */}
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>QUICK SUGGESTIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList}>
              {QUICK_PROMPTS.map((item, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSelectQuickPrompt(item)}
                  style={[styles.quickChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.quickChipText, { color: theme.ink }]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Prompt Input */}
            <Text style={[styles.label, { color: theme.ink }]}>Describe your message / campaign *</Text>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g., Send weekend 50% discount alert with coupon code..."
              placeholderTextColor={theme.muted}
              multiline
              numberOfLines={3}
              style={[styles.textarea, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.border }]}
            />

            {/* Category and Language */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.ink }]}>Category</Text>
                <View style={styles.chipRow}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: category === cat ? theme.emerald : theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: category === cat ? '#FFF' : theme.ink, fontSize: 10, fontWeight: '800' }}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.ink }]}>Language</Text>
                <View style={styles.chipRow}>
                  {LANGUAGES.map((lang) => (
                    <Pressable
                      key={lang}
                      onPress={() => setLanguage(lang)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: language === lang ? theme.emerald : theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: language === lang ? '#FFF' : theme.ink, fontSize: 10, fontWeight: '800' }}>
                        {lang.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.ink }]}>Tone</Text>
                <View style={styles.chipRow}>
                  {TONES.map((t) => (
                    <Pressable
                      key={t.value}
                      onPress={() => setTone(t.value)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: tone === t.value ? theme.emerald : theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: tone === t.value ? '#FFF' : theme.ink, fontSize: 10, fontWeight: '800' }}>
                        {t.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Advanced toggle */}
            <Pressable onPress={() => setShowAdvanced((v) => !v)} style={styles.advancedToggle}>
              <Info size={13} color={theme.emerald} />
              <Text style={[styles.advancedToggleText, { color: theme.emerald }]}>
                {showAdvanced ? 'Hide advanced options' : 'Show advanced options (Header, Buttons, Instructions)'}
              </Text>
            </Pressable>

            {showAdvanced && (
              <View style={[styles.advancedBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.label, { color: theme.ink }]}>Header format</Text>
                <View style={styles.chipRow}>
                  {HEADER_TYPES.map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => setHeaderType(h)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: headerType === h ? theme.emerald : theme.canvas,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: headerType === h ? '#FFF' : theme.ink, fontSize: 10, fontWeight: '800' }}>
                        {h}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: theme.ink, marginTop: 10 }]}>Buttons preference</Text>
                <View style={styles.chipRow}>
                  {AI_BUTTON_TYPES.map((b) => (
                    <Pressable
                      key={b}
                      onPress={() => setButtonType(b)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: buttonType === b ? theme.emerald : theme.canvas,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: buttonType === b ? '#FFF' : theme.ink, fontSize: 10, fontWeight: '800' }}>
                        {b}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: theme.ink, marginTop: 10 }]}>Custom instructions (optional)</Text>
                <TextInput
                  value={customInstructions}
                  onChangeText={setCustomInstructions}
                  placeholder="e.g., include an opt-out line, use 2 variables only..."
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.ink, backgroundColor: theme.canvas, borderColor: theme.border }]}
                />
              </View>
            )}

            {/* Generate Button */}
            <Pressable
              onPress={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={[
                styles.generateBtn,
                { backgroundColor: theme.emerald, opacity: loading || !prompt.trim() ? 0.6 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Sparkles size={18} color="#FFF" />
                  <Text style={styles.generateBtnText}>Generate with AI</Text>
                </>
              )}
            </Pressable>

            {/* Generated Template Preview */}
            {generatedData?.template && (
              <View style={[styles.previewSection, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <View style={styles.previewHeaderRow}>
                  <Text style={[styles.previewBadgeName, { color: theme.emerald }]}>
                    {generatedData.template.name}
                  </Text>
                  <Text style={[styles.previewBadgeCategory, { backgroundColor: theme.emerald + '15', color: theme.emerald }]}>
                    {generatedData.template.category}
                  </Text>
                </View>

                {/* WhatsApp Chat Bubble */}
                <View style={styles.bubbleContainer}>
                  <View style={styles.bubble}>
                    {headerComp && headerComp.text ? (
                      <Text style={styles.bubbleHeader}>{headerComp.text}</Text>
                    ) : headerComp && headerComp.format && headerComp.format !== 'NONE' && headerComp.format !== 'TEXT' ? (
                      <View style={styles.bubbleMediaPlaceholder}>
                        <Text style={styles.bubbleMediaPlaceholderText}>[{headerComp.format} Header]</Text>
                      </View>
                    ) : null}

                    <Text style={styles.bubbleBody}>{bodyComp?.text || ''}</Text>

                    {footerComp && footerComp.text ? (
                      <Text style={styles.bubbleFooter}>{footerComp.text}</Text>
                    ) : null}

                    {buttonsComp?.buttons?.map((btn: any, bIdx: number) => (
                      <View key={bIdx} style={styles.bubbleBtn}>
                        <MessageSquare size={12} color="#128C7E" />
                        <Text style={styles.bubbleBtnText}>{btn.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Explanation */}
                {generatedData.explanation ? (
                  <View style={[styles.explanationCard, { backgroundColor: theme.emerald + '10' }]}>
                    <Text style={[styles.explanationText, { color: theme.ink }]}>
                      💡 {generatedData.explanation}
                    </Text>
                  </View>
                ) : null}

                <Text style={[styles.editHint, { color: theme.muted }]}>
                  You can still edit the header, body, footer, variables and buttons after applying.
                </Text>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <Pressable onPress={handleApply} style={[styles.applyBtn, { borderColor: theme.emerald }]}>
                    <Check size={16} color={theme.emerald} />
                    <Text style={[styles.applyBtnText, { color: theme.emerald }]}>Apply to Editor</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSaveDirectly}
                    disabled={savingDirectly}
                    style={[styles.saveDirectBtn, { backgroundColor: theme.emerald }]}
                  >
                    {savingDirectly ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <CheckCircle size={16} color="#FFF" />
                        <Text style={styles.saveDirectBtnText}>Save Directly</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sparkleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  quickList: {
    gap: 8,
    paddingVertical: 2,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  textarea: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 12,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  selectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  advancedToggleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  advancedBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  generateBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  previewSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginTop: 8,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewBadgeName: {
    fontSize: 13,
    fontWeight: '900',
  },
  previewBadgeCategory: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bubbleContainer: {
    backgroundColor: '#E5DDD5',
    borderRadius: 14,
    padding: 12,
  },
  bubble: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    maxWidth: '96%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  bubbleMediaPlaceholder: {
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  bubbleMediaPlaceholderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  bubbleBody: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 17,
  },
  bubbleFooter: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 6,
  },
  bubbleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 6,
  },
  bubbleBtnText: {
    color: '#128C7E',
    fontSize: 11,
    fontWeight: '800',
  },
  explanationCard: {
    padding: 10,
    borderRadius: 10,
  },
  explanationText: {
    fontSize: 11,
    lineHeight: 15,
  },
  editHint: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  applyBtnText: {
    fontWeight: '800',
    fontSize: 12,
  },
  saveDirectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveDirectBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
});