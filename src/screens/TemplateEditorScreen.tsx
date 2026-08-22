import React, {useRef, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import { ArrowLeft, Paperclip, Plus, Sparkles, Trash2, X } from 'lucide-react-native';
import { AiTemplateModal } from '../components/AiTemplateModal';
import Toast from 'react-native-toast-message';
import {ApiSession} from '../api/client';
import {createTemplate, editTemplate} from '../api/workspace'
import {uploadFile, PickedFile} from '../api/upload';
import {useTheme} from '../theme/theme';
import {launchImageLibrary, ImagePickerResponse} from 'react-native-image-picker';
import {pick, types as DocumentPickerTypes, isErrorWithCode, errorCodes} from '@react-native-documents/picker';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES = ['en', 'hi', 'es', 'fr', 'de', 'ar'];
const BUTTON_TYPES = ['NONE', 'QUICK_REPLY', 'PHONE_NUMBER', 'URL'];
const HEADER_FORMATS: {code: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; label: string}[] = [
  {code: 'NONE', label: 'None'},
  {code: 'TEXT', label: 'Text'},
  {code: 'IMAGE', label: 'Image'},
  {code: 'VIDEO', label: 'Video'},
  {code: 'DOCUMENT', label: 'Document'},
];

function Picker({label, value, options, onChange, theme}: any) { const [open, setOpen] = useState(false); return <View><Text style={[styles.label, {color: theme.muted}]}>{label}</Text><Pressable onPress={() => setOpen(true)} style={[styles.select, {backgroundColor: theme.surface, borderColor: theme.border}]}><Text style={{color: theme.ink}}>{value}</Text><Text style={{color: theme.muted}}>⌄</Text></Pressable><Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><Pressable style={styles.overlay} onPress={() => setOpen(false)}><View style={[styles.sheet, {backgroundColor: theme.surface}]}>{options.map((option: string) => <Pressable key={option} onPress={() => {onChange(option); setOpen(false);}} style={styles.option}><Text style={[styles.optionText, {color: theme.ink}]}>{option}</Text></Pressable>)}</View></Pressable></Modal></View>; }

function TemplatePreview({theme, headerFormat, header, headerMediaLink, body, footer, buttonType, buttonText, variables}: any) {
  let sampleBody = body || 'Your message preview will appear here.';
  (variables || []).forEach((v: any) => {
    sampleBody = sampleBody.replace(new RegExp(`\\{\\{${v.id}\\}\\}`, 'g'), v.sample?.trim() ? v.sample : `{{${v.id}}}`);
  });
  return <View style={[styles.previewCard, {backgroundColor: theme.surface, borderColor: theme.border}]}><Text style={[styles.previewTitle, {color: theme.ink}]}>Preview</Text><View style={styles.phone}><View style={styles.phoneTop}><Text style={styles.phoneTopText}>WhatsApp</Text></View><View style={styles.chat}><View style={styles.bubble}>
    {headerFormat === 'TEXT' && header ? <Text style={styles.previewHeader}>{header}</Text> : null}
    {headerFormat !== 'NONE' && headerFormat !== 'TEXT' ? (
      <View style={styles.previewMediaPlaceholder}>
        <Text style={styles.previewMediaPlaceholderText}>{headerMediaLink ? `[${headerFormat} attached]` : `[${headerFormat} header]`}</Text>
      </View>
    ) : null}
    <Text style={styles.previewBody}>{sampleBody}</Text>{footer ? <Text style={styles.previewFooter}>{footer}</Text> : null}{buttonType !== 'NONE' && buttonText ? <View style={styles.previewButton}><Text style={styles.previewButtonText}>{buttonText}</Text></View> : null}</View><Text style={styles.previewTime}>10:32 AM ✓✓</Text></View></View></View>;
}

// Extracts unique {{n}} variable numbers from text, in order of first appearance.
function extractVariableOrder(text: string): number[] {
  const regex = /\{\{(\d+)\}\}/g;
  const seen = new Set<number>();
  const order: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!seen.has(num)) {
      seen.add(num);
      order.push(num);
    }
  }
  return order;
}

// Renumbers variables in text sequentially (1, 2, 3...) based on order of appearance,
// and returns both the new text and a map from old variable number -> new variable number.
function renumberVariables(text: string): {text: string; oldToNew: Map<number, number>} {
  const order = extractVariableOrder(text);
  const oldToNew = new Map<number, number>();
  order.forEach((oldNum, idx) => oldToNew.set(oldNum, idx + 1));

  let result = text;
  const sortedDesc = [...order].sort((a, b) => b - a);
  sortedDesc.forEach((oldNum) => {
    const newNum = oldToNew.get(oldNum)!;
    if (oldNum !== newNum) {
      result = result.split(`{{${oldNum}}}`).join(`{{TEMP_${newNum}}}`);
    }
  });
  result = result.replace(/\{\{TEMP_(\d+)\}\}/g, '{{$1}}');
  return {text: result, oldToNew};
}

export function TemplateEditorScreen({projectId, session, template, onBack, onSaved}: {projectId: string; session: ApiSession; template?: any; onBack: () => void; onSaved: () => void}) {
  const theme = useTheme(); const cs = template?.template?.components || template?.components || []; const get = (type: string) => cs.find((c: any) => c.type === type) || {}; const button = get('BUTTONS').buttons?.[0] || {};
  const initialHeader = get('HEADER');
  const [name, setName] = useState(template?.template_name || template?.name || ''); const [category, setCategory] = useState(template?.category || 'UTILITY'); const [language, setLanguage] = useState(template?.language || template?.language_code || 'en');
  const [headerFormat, setHeaderFormat] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>(
    initialHeader.format || (initialHeader.text ? 'TEXT' : 'NONE'),
  );
  const [header, setHeader] = useState(initialHeader.text || '');
  const [headerMediaLink, setHeaderMediaLink] = useState(initialHeader.example?.header_handle?.[0] || '');
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [body, setBody] = useState(get('BODY').text || ''); const [footer, setFooter] = useState(get('FOOTER').text || ''); const [buttonType, setButtonType] = useState(button.type || 'NONE'); const [buttonText, setButtonText] = useState(button.text || ''); const [buttonValue, setButtonValue] = useState(button.phone_number || button.url || ''); const [saving, setSaving] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);

  // Body variables: [{id: variableNumber, sample: string}], kept in ascending id order (1, 2, 3...)
  const initialSamples = get('BODY').example?.body_text?.[0] || [];
  const [bodyVariables, setBodyVariables] = useState<{id: number; sample: string}[]>(
    extractVariableOrder(get('BODY').text || '').map((num, idx) => ({id: num, sample: String(initialSamples[idx] || '')})),
  );
  const [bodySelection, setBodySelection] = useState({start: 0, end: 0});
  const bodyInputRef = useRef<TextInput>(null);

  const handleHeaderFormatChange = (format: typeof headerFormat) => {
    setHeaderFormat(format);
    if (format !== 'TEXT') setHeader('');
    if (format !== 'IMAGE' && format !== 'VIDEO' && format !== 'DOCUMENT') setHeaderMediaLink('');
  };

  const pickHeaderMedia = async () => {
    try {
      let pickedFile: PickedFile | null = null;

      if (headerFormat === 'IMAGE' || headerFormat === 'VIDEO') {
        // react-native-image-picker handles OS permission prompts internally,
        // no separate permission request call needed.
        const result: ImagePickerResponse = await launchImageLibrary({
          mediaType: headerFormat === 'IMAGE' ? 'photo' : 'video',
          selectionLimit: 1,
        });

        if (result.didCancel) return;
        if (result.errorMessage) throw new Error(result.errorMessage);

        const asset = result.assets?.[0];
        if (!asset?.uri) return;

        pickedFile = {
          uri: asset.uri,
          name: asset.fileName || `header-${Date.now()}`,
          type: asset.type || (headerFormat === 'IMAGE' ? 'image/jpeg' : 'video/mp4'),
        };
      } else if (headerFormat === 'DOCUMENT') {
        const [result] = await pick({ type: [DocumentPickerTypes.allFiles] });
        pickedFile = {
          uri: result.uri,
          name: result.name || `header-${Date.now()}`,
          type: result.type || 'application/octet-stream',
        };
      }

      if (!pickedFile) return;

      setIsUploadingHeader(true);
      const response = await uploadFile(pickedFile);
      setHeaderMediaLink(response.url);
      Toast.show({type: 'success', text1: 'Header media uploaded'});
    } catch (error: any) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
      Toast.show({type: 'error', text1: 'Failed to upload file', text2: error?.message || 'Check your media picker setup'});
    } finally {
      setIsUploadingHeader(false);
    }
  };

  // Re-syncs bodyVariables whenever body text changes, renumbering to keep variables sequential
  // and preserving sample values across the renumbering using the old->new number map.
  const handleBodyChange = (rawText: string) => {
    const {text: finalText, oldToNew} = renumberVariables(rawText);

    setBodyVariables((prevVars) => {
      const oldSampleById = new Map(prevVars.map((v) => [v.id, v.sample]));
      const newOrder = extractVariableOrder(finalText);
      return newOrder.map((newNum) => {
        // find which old id maps to this new id
        let oldNum: number | undefined;
        for (const [o, n] of oldToNew.entries()) {
          if (n === newNum) { oldNum = o; break; }
        }
        const sample = oldNum !== undefined ? (oldSampleById.get(oldNum) || '') : '';
        return {id: newNum, sample};
      });
    });

    setBody(finalText);
  };

  const addBodyVariable = () => {
    const nextNum = extractVariableOrder(body).length + 1;
    const insertAt = Math.min(bodySelection.start, body.length);
    const token = `{{${nextNum}}}`;
    const newText = body.slice(0, insertAt) + token + body.slice(insertAt);
    handleBodyChange(newText);
    setBodySelection({start: insertAt + token.length, end: insertAt + token.length});
  };

  const removeBodyVariable = (id: number) => {
    const newText = body.split(`{{${id}}}`).join('');
    handleBodyChange(newText);
  };

  const updateBodyVariableSample = (id: number, sample: string) => {
    setBodyVariables((prev) => prev.map((v) => (v.id === id ? {...v, sample} : v)));
  };

  const applyAiTemplate = (aiData: any) => {
    if (!aiData?.template) return;
    const t = aiData.template;
    const comps = t.components || [];
    const getComp = (type: string) => comps.find((c: any) => String(c.type).toUpperCase() === type) || {};
    const btnsComp = getComp('BUTTONS');
    const firstBtn = btnsComp?.buttons?.[0] || {};

    if (t.name) setName(t.name);
    if (t.category) setCategory(t.category);
    if (t.language) setLanguage(t.language);
    setFooter(getComp('FOOTER').text || '');
    setButtonType(firstBtn.type || 'NONE');
    setButtonText(firstBtn.text || '');
    setButtonValue(firstBtn.phone_number || firstBtn.url || '');

    // Sync header format + content from the AI response. Media formats come back without an
    // actual uploaded file, so we set the format and let the user upload the file themselves.
    const aiHeaderComp = getComp('HEADER');
    const aiHeaderFormat = (aiHeaderComp.format || (aiHeaderComp.text ? 'TEXT' : 'NONE')) as typeof headerFormat;
    setHeaderFormat(aiHeaderFormat);
    if (aiHeaderFormat === 'TEXT') {
      setHeader(aiHeaderComp.text || '');
      setHeaderMediaLink('');
    } else if (aiHeaderFormat === 'IMAGE' || aiHeaderFormat === 'VIDEO' || aiHeaderFormat === 'DOCUMENT') {
      setHeader('');
      setHeaderMediaLink(aiHeaderComp.example?.header_handle?.[0] || '');
    } else {
      setHeader('');
      setHeaderMediaLink('');
    }

    // Sync body + variables together, seeding sample values from the AI's suggested
    // sample_variables (or the component's own examples) wherever possible.
    const aiBodyText = getComp('BODY').text || '';
    const {text: renumberedBody} = renumberVariables(aiBodyText);
    const aiExampleSamples = getComp('BODY').example?.body_text?.[0] || [];
    const varOrder = extractVariableOrder(renumberedBody);
    // Map from renumbered id back to its original position in aiBodyText to look up sample_variables
    const originalOrder = extractVariableOrder(aiBodyText);
    setBody(renumberedBody);
    setBodyVariables(
      varOrder.map((newNum, idx) => {
        const originalNum = originalOrder[idx];
        const seeded =
          aiData?.sample_variables?.[String(originalNum)] ??
          aiExampleSamples?.[idx] ??
          '';
        return {id: newNum, sample: String(seeded || '')};
      }),
    );

    Toast.show({type: 'success', text1: 'AI template loaded — feel free to edit it below'});
    if (aiHeaderFormat !== 'NONE' && aiHeaderFormat !== 'TEXT' && !aiHeaderComp.example?.header_handle?.[0]) {
      Toast.show({type: 'info', text1: `Don't forget to upload a ${aiHeaderFormat.toLowerCase()} for the header`});
    }
  };

  const field = (value: string, setValue: (value: string) => void, placeholder: string, multiline = false) => <TextInput value={value} onChangeText={setValue} multiline={multiline} placeholder={placeholder} placeholderTextColor={theme.muted} style={[multiline ? styles.textarea : styles.input, {color: theme.ink, borderColor: theme.border, backgroundColor: theme.surface}]}/>;

  const save = async () => {
    if (!name.trim() || !body.trim()) return Toast.show({type: 'error', text1: 'Name and body are required'});
    if (headerFormat === 'TEXT' && !header.trim()) return Toast.show({type: 'error', text1: 'Header text is required for a text header'});
    if ((headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && !headerMediaLink) {
      return Toast.show({type: 'error', text1: `Please upload a ${headerFormat.toLowerCase()} for the header`});
    }
    if (buttonType !== 'NONE' && !buttonText.trim()) return Toast.show({type: 'error', text1: 'Button text is required'});
    if (bodyVariables.length > 0 && bodyVariables.some((v) => !v.sample || !v.sample.trim())) {
      return Toast.show({type: 'error', text1: 'Please add a sample value for every variable'});
    }
    setSaving(true);
    try {
      const components: any[] = [{type: 'BODY', text: body.trim()}];
      if (bodyVariables.length > 0) {
        components[0].example = {body_text: [bodyVariables.map((v) => v.sample.trim())]};
      }
      if (headerFormat === 'TEXT' && header.trim()) {
        components.unshift({type: 'HEADER', format: 'TEXT', text: header.trim()});
      } else if ((headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && headerMediaLink) {
        components.unshift({type: 'HEADER', format: headerFormat, example: {header_handle: [headerMediaLink]}});
      }
      if (footer.trim()) components.push({type: 'FOOTER', text: footer.trim()});
      if (buttonType !== 'NONE') {
        const b: any = {type: buttonType, text: buttonText.trim()};
        if (buttonType === 'PHONE_NUMBER') b.phone_number = buttonValue.trim();
        if (buttonType === 'URL') b.url = buttonValue.trim();
        components.push({type: 'BUTTONS', buttons: [b]});
      }
      const payload = {name: name.trim().toLowerCase().replace(/\s+/g, '_'), category, language, components};
      const response = template ? await editTemplate(session, projectId, template.template_id || template.id, payload) : await createTemplate(session, projectId, payload);
      if (response?.error) throw new Error('Template save failed');
      Toast.show({type: 'success', text1: template ? 'Template updated' : 'Template created'});
      onSaved();
    } catch (error: any) {
      Toast.show({type: 'error', text1: 'Could not save template', text2: error?.message});
    } finally {
      setSaving(false);
    }
  };

  return <View style={[styles.container, {backgroundColor: theme.canvas}]}><View style={[styles.header, {backgroundColor: theme.header, borderBottomColor: theme.border}]}><Pressable onPress={onBack} style={styles.back}><ArrowLeft size={21} color={theme.ink}/></Pressable><View><Text style={[styles.title, {color: theme.ink}]}>{template ? 'Edit Template' : 'Create Template'}</Text><Text style={[styles.subtitle, {color: theme.muted}]}>WhatsApp message template</Text></View></View><ScrollView contentContainerStyle={styles.form}><Pressable onPress={() => setAiModalVisible(true)} style={[styles.aiBanner, {backgroundColor: theme.emerald + '15', borderColor: theme.emerald}]}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        <Sparkles size={16} color={theme.emerald}/>
        <Text style={[styles.aiBannerText, {color: theme.emerald}]}>Generate with AI Assistant</Text>
      </View>
      <Text style={[styles.aiBannerSub, {color: theme.emerald}]}>Auto-fill</Text>
    </Pressable>
    <TemplatePreview theme={theme} headerFormat={headerFormat} header={header} headerMediaLink={headerMediaLink} body={body} footer={footer} buttonType={buttonType} buttonText={buttonText} variables={bodyVariables}/><Text style={[styles.sectionTitle, {color: theme.ink}]}>Template details</Text><Text style={[styles.label, {color: theme.muted}]}>Template name *</Text>{field(name, setName, 'order_update')}<Picker label="Category" value={category} options={CATEGORIES} onChange={setCategory} theme={theme}/><Picker label="Language" value={language} options={LANGUAGES} onChange={setLanguage} theme={theme}/>

    <Text style={[styles.label, {color: theme.muted}]}>Header Format</Text>
    <View style={styles.headerFormatGrid}>
      {HEADER_FORMATS.map((fmt) => (
        <Pressable
          key={fmt.code}
          onPress={() => handleHeaderFormatChange(fmt.code)}
          style={[
            styles.headerFormatBtn,
            {
              backgroundColor: headerFormat === fmt.code ? theme.emerald + '15' : theme.surface,
              borderColor: headerFormat === fmt.code ? theme.emerald : theme.border,
            },
          ]}
        >
          <Text style={{color: headerFormat === fmt.code ? theme.emerald : theme.ink, fontSize: 13, fontWeight: '700'}}>{fmt.label}</Text>
        </Pressable>
      ))}
    </View>

    {headerFormat === 'TEXT' && (
      <>
        <Text style={[styles.label, {color: theme.muted}]}>Header text</Text>
        {field(header, setHeader, 'Optional header')}
      </>
    )}

    {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
      <View style={[styles.mediaSection, {backgroundColor: theme.surface, borderColor: theme.border}]}>
        <Text style={[styles.label, {color: theme.ink, marginTop: 0}]}>Header Content ({headerFormat})</Text>
        {headerMediaLink ? (
          <View style={[styles.mediaFileRow, {backgroundColor: theme.canvas, borderColor: theme.border}]}>
            <View style={styles.mediaFileInfo}>
              <Paperclip size={15} color={theme.muted} />
              <Text style={[styles.mediaFileName, {color: theme.ink}]} numberOfLines={1}>
                {headerMediaLink.split('/').pop()}
              </Text>
            </View>
            <Pressable onPress={() => setHeaderMediaLink('')}>
              <X size={16} color={theme.muted} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickHeaderMedia}
            disabled={isUploadingHeader}
            style={[styles.mediaUploadBox, {borderColor: theme.border, opacity: isUploadingHeader ? 0.6 : 1}]}
          >
            {isUploadingHeader ? (
              <>
                <ActivityIndicator color={theme.emerald} />
                <Text style={[styles.mediaUploadText, {color: theme.muted}]}>Uploading...</Text>
              </>
            ) : (
              <>
                <Paperclip size={22} color={theme.muted} />
                <Text style={[styles.mediaUploadText, {color: theme.muted}]}>Tap to upload {headerFormat.toLowerCase()}</Text>
                <Text style={[styles.mediaUploadHint, {color: theme.muted}]}>MAX. 5MB</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    )}

    <View style={styles.bodyLabelRow}>
      <Text style={[styles.label, {color: theme.muted, marginTop: 0}]}>Body *</Text>
      <Pressable onPress={addBodyVariable} style={[styles.addVarBtn, {backgroundColor: theme.emerald + '15'}]}>
        <Plus size={12} color={theme.emerald} />
        <Text style={[styles.addVarBtnText, {color: theme.emerald}]}>Add Variable {`{{${extractVariableOrder(body).length + 1}}}`}</Text>
      </Pressable>
    </View>
    <TextInput
      ref={bodyInputRef}
      value={body}
      onChangeText={handleBodyChange}
      onSelectionChange={(e) => setBodySelection(e.nativeEvent.selection)}
      multiline
      numberOfLines={5}
      placeholder="Hello {{1}}, tap Add Variable to insert a placeholder"
      placeholderTextColor={theme.muted}
      style={[styles.textarea, {color: theme.ink, borderColor: theme.border, backgroundColor: theme.surface}]}
    />

    {bodyVariables.length > 0 && (
      <View style={styles.varList}>
        {bodyVariables.map((variable) => (
          <View key={variable.id} style={[styles.varCard, {backgroundColor: theme.surface, borderColor: theme.border}]}>
            <View style={styles.varCardHeader}>
              <View style={styles.varBadgeRow}>
                <Text style={[styles.varBadge, {backgroundColor: theme.emerald + '15', color: theme.emerald}]}>{`{{${variable.id}}}`}</Text>
              </View>
              <Pressable onPress={() => removeBodyVariable(variable.id)} style={styles.varRemoveBtn}>
                <Trash2 size={14} color="#DC2626" />
              </Pressable>
            </View>
            <TextInput
              value={variable.sample}
              onChangeText={(text) => updateBodyVariableSample(variable.id, text)}
              placeholder={`Sample value for {{${variable.id}}}`}
              placeholderTextColor={theme.muted}
              style={[styles.varInput, {color: theme.ink, borderColor: theme.border, backgroundColor: theme.canvas}]}
            />
          </View>
        ))}
      </View>
    )}

    <Text style={[styles.label, {color: theme.muted}]}>Footer text</Text>{field(footer, setFooter, 'Optional footer')}<Picker label="Button" value={buttonType} options={BUTTON_TYPES} onChange={setButtonType} theme={theme}/>{buttonType !== 'NONE' && <><Text style={[styles.label, {color: theme.muted}]}>Button text *</Text>{field(buttonText, setButtonText, 'Learn more')}{buttonType !== 'QUICK_REPLY' && <><Text style={[styles.label, {color: theme.muted}]}>{buttonType === 'URL' ? 'Button URL' : 'Phone number'}</Text>{field(buttonValue, setButtonValue, buttonType === 'URL' ? 'https://example.com' : '+919999999999')}</>}</>}<Pressable onPress={save} disabled={saving} style={[styles.save, {backgroundColor: theme.emerald}]}>{saving ? <ActivityIndicator color="#FFF"/> : <Text style={styles.saveText}>{template ? 'Save changes' : 'Create template'}</Text>}</Pressable><AiTemplateModal visible={aiModalVisible} onClose={() => setAiModalVisible(false)} session={session} projectId={projectId} onApplyTemplate={applyAiTemplate} onSavedDirectly={onSaved}/>
    </ScrollView></View>;
}

const styles = StyleSheet.create({container: {flex: 1}, header: {padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1}, back: {padding: 4, marginRight: 10}, title: {fontSize: 19, fontWeight: '800'}, subtitle: {fontSize: 11, marginTop: 2}, form: {padding: 17, gap: 10}, sectionTitle: {fontSize: 16, fontWeight: '900', marginTop: 2}, label: {fontSize: 11, fontWeight: '800', marginTop: 4}, input: {height: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: 14}, textarea: {minHeight: 120, borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 14, textAlignVertical: 'top'}, select: {height: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end'}, sheet: {padding: 18, borderTopLeftRadius: 22, borderTopRightRadius: 22}, option: {paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB'}, optionText: {fontSize: 14, fontWeight: '700'}, save: {paddingVertical: 15, borderRadius: 11, alignItems: 'center', marginTop: 10}, saveText: {color: '#FFF', fontWeight: '800'}, aiBanner: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4}, aiBannerText: {fontSize: 13, fontWeight: '900'}, aiBannerSub: {fontSize: 11, fontWeight: '800'}, previewCard: {borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 3}, previewTitle: {fontSize: 14, fontWeight: '900', marginBottom: 9}, phone: {borderRadius: 15, overflow: 'hidden', backgroundColor: '#E6DDD5', maxWidth: 360, alignSelf: 'center', width: '100%'}, phoneTop: {backgroundColor: '#075E54', paddingVertical: 9, paddingHorizontal: 12}, phoneTopText: {color: '#FFF', fontSize: 12, fontWeight: '800'}, chat: {padding: 13, minHeight: 155, justifyContent: 'flex-end'}, bubble: {backgroundColor: '#FFF', borderRadius: 10, borderTopLeftRadius: 3, padding: 10, alignSelf: 'flex-start', maxWidth: '94%', shadowColor: '#000', shadowOpacity: .08, shadowRadius: 3, elevation: 1}, previewHeader: {fontWeight: '900', color: '#111827', fontSize: 13}, previewBody: {color: '#1F2937', fontSize: 13, lineHeight: 18, marginTop: 5}, previewFooter: {color: '#6B7280', fontSize: 11, marginTop: 7}, previewButton: {borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 9, paddingTop: 8}, previewButtonText: {color: '#128C7E', textAlign: 'center', fontWeight: '800', fontSize: 12}, previewTime: {color: '#6B7280', fontSize: 9, alignSelf: 'flex-end', marginTop: 4},
  previewMediaPlaceholder: {height: 50, borderRadius: 7, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4},
  previewMediaPlaceholderText: {fontSize: 9, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.4},
  bodyLabelRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6},
  addVarBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8},
  addVarBtnText: {fontSize: 10, fontWeight: '800'},
  varList: {gap: 8, marginTop: 4},
  varCard: {borderWidth: 1, borderRadius: 11, padding: 10},
  varCardHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6},
  varBadgeRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  varBadge: {fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden'},
  varRemoveBtn: {padding: 4},
  varInput: {height: 40, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, fontSize: 13},
  headerFormatGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6},
  headerFormatBtn: {flexBasis: '31%', flexGrow: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center'},
  mediaSection: {borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4, gap: 8},
  mediaFileRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9},
  mediaFileInfo: {flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8},
  mediaFileName: {fontSize: 12, fontWeight: '700', flexShrink: 1},
  mediaUploadBox: {borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 22, alignItems: 'center', justifyContent: 'center', gap: 4},
  mediaUploadText: {fontSize: 12, fontWeight: '700'},
  mediaUploadHint: {fontSize: 10},
});