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
import { X, Sparkles, Zap, Check, CheckCircle, ArrowRight, MessageSquare, Info } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ApiSession } from '../api/client';
import { generateAiTemplate, createTemplate } from '../api/workspace';
import { useTheme } from '../theme/theme';
import { KeyboardAvoidView } from './KeyboardAvoidView';
import { SlideUpModal } from './animations';

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
        button_type: buttonType,
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
    Toast.show({ type: 'success', text1: 'Applied to template editor' });
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

            {/* Category and Tone */}
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
    height: '88%',
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  selectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
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
