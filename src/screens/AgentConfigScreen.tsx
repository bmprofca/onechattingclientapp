import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { ArrowLeft, KeyRound, Plus, Shield, Trash2 } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { AgentApiKey, deleteAgentApiKey, listAgentApiKeys, saveAgentApiKey, setPersonalKeyUsage } from '../api/context';
import { useTheme } from '../theme/theme';

export function AgentConfigScreen({ projectId, session, onBack }: { projectId: string; session: ApiSession; onBack: () => void }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [personal, setPersonal] = useState(false);
  const [tab, setTab] = useState<'onechat' | 'personal'>('onechat');
  const [keys, setKeys] = useState<AgentApiKey[]>([]);
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAgentApiKeys(session, projectId);
      const data = response.data || response;
      const usePersonal = Boolean(data.agent_use_personal_key);
      setPersonal(usePersonal); setTab(usePersonal ? 'personal' : 'onechat');
      setKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch (error) { Toast.show({ type: 'error', text1: 'Could not load agent settings', text2: error instanceof Error ? error.message : undefined }); }
    finally { setLoading(false); }
  }, [projectId, session]);
  useEffect(() => { load(); }, [load]);

  const changeTab = async (next: 'onechat' | 'personal') => {
    if (next === tab) return;
    setTab(next);
    if (next === 'personal' && keys.length === 0) return;
    try {
      await setPersonalKeyUsage(session, projectId, next === 'personal'); setPersonal(next === 'personal');
    } catch (error) { setTab(personal ? 'personal' : 'onechat'); Toast.show({ type: 'error', text1: 'Could not change provider', text2: error instanceof Error ? error.message : undefined }); }
  };
  const addKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try { await saveAgentApiKey(session, projectId, provider, apiKey.trim()); setApiKey(''); await load(); await setPersonalKeyUsage(session, projectId, true); setPersonal(true); setTab('personal'); Toast.show({ type: 'success', text1: 'API key saved' }); }
    catch (error) { Toast.show({ type: 'error', text1: 'Could not save API key', text2: error instanceof Error ? error.message : undefined }); }
    finally { setSaving(false); }
  };
  const removeKey = (key: AgentApiKey) => Alert.alert('Delete API Key', `Delete the ${key.api_provider} API key?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteAgentApiKey(session, projectId, key.unique_id); const response = await listAgentApiKeys(session, projectId); const remaining = (response.data || response).keys || []; if (remaining.length === 0) await setPersonalKeyUsage(session, projectId, false); await load(); Toast.show({ type: 'success', text1: 'API key deleted' }); } catch (error) { Toast.show({ type: 'error', text1: 'Could not delete API key', text2: error instanceof Error ? error.message : undefined }); } } }]);

  return <View style={[styles.safe, { backgroundColor: theme.canvas }]}><View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}><Pressable onPress={onBack} style={styles.back}><ArrowLeft size={24} color={theme.ink} /></Pressable><Text style={[styles.headerTitle, { color: theme.ink }]}>Agent Configuration</Text><View style={styles.back} /></View>{loading ? <View style={styles.center}><ActivityIndicator color={theme.emerald} size="large" /></View> : <ScrollView contentContainerStyle={styles.page}><View style={styles.intro}><View style={[styles.icon, { backgroundColor: theme.mint }]}><Shield size={24} color={theme.emerald} /></View><View style={{ flex: 1 }}><Text style={[styles.title, { color: theme.ink }]}>Agent provider and key settings</Text><Text style={[styles.copy, { color: theme.muted }]}>Choose OneChat’s managed provider or your personal API key.</Text></View></View><View style={[styles.tabs, { backgroundColor: theme.cardHover, borderColor: theme.border }]}><Pressable onPress={() => changeTab('onechat')} style={[styles.tab, tab === 'onechat' && { backgroundColor: theme.surface }]}><Text style={[styles.tabText, { color: tab === 'onechat' ? theme.ink : theme.muted }]}>OneChat’s</Text></Pressable><Pressable onPress={() => changeTab('personal')} style={[styles.tab, tab === 'personal' && { backgroundColor: theme.surface }]}><Text style={[styles.tabText, { color: tab === 'personal' ? theme.ink : theme.muted }]}>Personal</Text></Pressable></View><Text style={[styles.status, { color: theme.muted }]}>{personal ? 'Currently active: your personal API key.' : 'Currently active: OneChat’s managed provider.'}</Text>{tab === 'onechat' ? <View style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.copy, { color: theme.muted }]}>OneChat will use its managed provider and default model. No personal API key is required.</Text></View> : <><Text style={[styles.section, { color: theme.ink }]}>Saved API Keys</Text>{keys.length === 0 ? <View style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.copy, { color: theme.muted }]}>No personal keys saved. Add one below to activate personal-key mode.</Text></View> : keys.map(key => <View key={key.unique_id} style={[styles.keyRow, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={{ flex: 1 }}><Text style={[styles.keyProvider, { color: theme.ink }]}>{key.api_provider}</Text><Text style={[styles.keyMasked, { color: theme.muted }]}>{key.api_key_masked}</Text><Text style={[styles.keyStatus, { color: key.is_active ? theme.emerald : theme.muted }]}>{key.is_active ? 'Active' : 'Inactive'}</Text></View><Pressable onPress={() => removeKey(key)} style={styles.delete}><Trash2 size={19} color={theme.danger} /></Pressable></View>)}<Text style={[styles.section, { color: theme.ink }]}>Add New Key</Text><Text style={[styles.label, { color: theme.muted }]}>PROVIDER</Text><View style={styles.providers}>{['gemini', 'claude', 'openai', 'groq'].map(value => <Pressable key={value} onPress={() => setProvider(value)} style={[styles.provider, { borderColor: provider === value ? theme.emerald : theme.border, backgroundColor: provider === value ? theme.mint : theme.surface }]}><Text style={{ color: theme.ink }}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View><Text style={[styles.label, { color: theme.muted }]}>API KEY</Text><TextInput secureTextEntry value={apiKey} onChangeText={setApiKey} placeholder="Enter your provider API key" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.border }]} /><Pressable disabled={saving || !apiKey.trim()} onPress={addKey} style={[styles.save, { backgroundColor: theme.emerald }, (saving || !apiKey.trim()) && styles.dim]}>{saving ? <ActivityIndicator color="#FFF" /> : <><Plus color="#FFF" size={18} /><Text style={styles.saveText}>Add API Key</Text></>}</Pressable></>}</ScrollView>}</View>;
}
const styles = StyleSheet.create({ safe: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, headerTitle: { fontSize: 18, fontWeight: '800' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, page: { padding: 16, paddingBottom: 36 }, intro: { flexDirection: 'row', gap: 12, marginBottom: 20 }, icon: { padding: 10, borderRadius: 12 }, title: { fontSize: 17, fontWeight: '800' }, copy: { fontSize: 14, lineHeight: 20, marginTop: 3 }, tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4 }, tab: { flex: 1, borderRadius: 9, paddingVertical: 11, alignItems: 'center' }, tabText: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, marginTop: 10 }, note: { marginTop: 20, borderWidth: 1, borderRadius: 14, padding: 15 }, section: { fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 12 }, keyRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 }, keyProvider: { textTransform: 'capitalize', fontSize: 15, fontWeight: '800' }, keyMasked: { fontSize: 13, marginTop: 3 }, keyStatus: { fontSize: 12, fontWeight: '700', marginTop: 7 }, delete: { padding: 8, alignSelf: 'center' }, label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginTop: 12 }, providers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, provider: { borderWidth: 1, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12 }, input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15 }, save: { marginTop: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 }, saveText: { color: '#FFF', fontSize: 15, fontWeight: '800' }, dim: { opacity: 0.55 } });
