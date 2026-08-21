import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { ArrowLeft, Bell, Bot, ChevronRight, FileText, GitBranch, MessageSquare, Settings, Shield, UserCheck, Zap } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAutoCaseCreateStatus, getBotSettings, setAutoCaseCreate, setAutoReply, setAutoReplyType } from '../api/context';
import { useTheme } from '../theme/theme';
import { getFlowStatus, setFlowEnabled } from '../api/flowBuilder';
import { FadeInView } from '../components/animations';

type Props = {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
  onOpenAgent: () => void;
  onOpenContext: () => void;
  onOpenFlow: () => void;
};

export function ProjectConfigScreen({ projectId, session, onBack, onOpenAgent, onOpenContext, onOpenFlow }: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [autoCaseCreate, setAutoCaseCreateState] = useState(false);
  const [autoReply, setAutoReplyState] = useState(false);
  const [replyType, setReplyType] = useState<'all' | 'new'>('all');
  const [flowEnabled, setFlowEnabledState] = useState(false);
  const [activeFlow, setActiveFlow] = useState<{flow_id: string; name: string; status: string; version: number} | null>(null);
  const [updating, setUpdating] = useState<'case' | 'reply' | 'type' | 'flow' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseResponse, settingsResponse, flowResponse] = await Promise.all([getAutoCaseCreateStatus(session, projectId), getBotSettings(session, projectId), getFlowStatus(session, projectId)]);
      const caseData = caseResponse.data || caseResponse;
      const settings = settingsResponse.data || settingsResponse;
      setAutoCaseCreateState(Boolean(caseData.status));
      setAutoReplyState(Boolean(settings.auto_reply ?? settings.auto_reply_status));
      setReplyType(settings.auto_reply_type === 'new' ? 'new' : 'all');
      setFlowEnabledState(Boolean(flowResponse.flow_builder_enabled));
      setActiveFlow(flowResponse.active_flow || null);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Could not load configuration', text2: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [projectId, session]);

  useEffect(() => { load(); }, [load]);

  const toggleCase = async (value: boolean) => {
    setUpdating('case');
    try {
      await setAutoCaseCreate(session, projectId, value);
      setAutoCaseCreateState(value);
      Toast.show({ type: 'success', text1: 'Auto case create updated' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: error instanceof Error ? error.message : undefined });
    } finally { setUpdating(null); }
  };

  const toggleFlow = async (value: boolean) => {
    if (!activeFlow?.flow_id) {
      Toast.show({type: 'error', text1: 'No published flow', text2: 'Publish a flow before enabling Flow Builder.'});
      return;
    }
    setUpdating('flow');
    try {
      const response = await setFlowEnabled(session, projectId, activeFlow.flow_id, value);
      if (response?.error) throw new Error(typeof response.error === 'string' ? response.error : 'Flow Builder update failed');
      setFlowEnabledState(value);
      Toast.show({type: 'success', text1: `Flow Builder ${value ? 'enabled' : 'disabled'}`});
    } catch (error) {
      Toast.show({type: 'error', text1: 'Flow Builder update failed', text2: error instanceof Error ? error.message : undefined});
    } finally { setUpdating(null); }
  };

  const toggleReply = async (value: boolean) => {
    setUpdating('reply');
    try {
      await setAutoReply(session, projectId, value);
      setAutoReplyState(value);
      Toast.show({ type: 'success', text1: 'Auto reply updated' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: error instanceof Error ? error.message : undefined });
    } finally { setUpdating(null); }
  };

  const changeReplyType = async (value: 'all' | 'new') => {
    if (value === replyType) return;
    setUpdating('type');
    try {
      await setAutoReplyType(session, projectId, value);
      setReplyType(value);
      Toast.show({ type: 'success', text1: 'Reply scope updated' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: error instanceof Error ? error.message : undefined });
    } finally { setUpdating(null); }
  };

  return <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
    <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
      <Pressable onPress={onBack} style={styles.back}><ArrowLeft color={theme.ink} size={24} /></Pressable>
      <Text style={[styles.headerTitle, { color: theme.ink }]}>Project Configuration</Text>
      <View style={styles.back} />
    </View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color={theme.emerald} /></View> :
      <FadeInView delay={60} distance={14} duration={300} style={{ flex: 1 }}><ScrollView contentContainerStyle={styles.page}>
        <View style={styles.intro}><Settings color={theme.emerald} size={28} /><View style={styles.introCopy}><Text style={[styles.title, { color: theme.ink }]}>Project Configuration</Text><Text style={[styles.copy, { color: theme.muted }]}>Manage settings for this project.</Text></View></View>
        <ConfigCard icon={<Zap color={theme.emerald} />} title="Auto Case Create" description="Create a new case automatically based on your project rules." theme={theme} right={<Switch value={autoCaseCreate} disabled={updating === 'case'} onValueChange={toggleCase} trackColor={{ false: theme.border, true: theme.emerald }} />} />
        <Pressable onPress={onOpenFlow} style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && { backgroundColor: theme.cardHover }]}>
          <View style={styles.cardTop}><View style={[styles.iconBox, { backgroundColor: theme.mint }]}><GitBranch color={theme.emerald} /></View><Switch value={flowEnabled} disabled={updating === 'flow' || !activeFlow} onValueChange={toggleFlow} trackColor={{ false: theme.border, true: theme.emerald }} /></View>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Flow Builder</Text>
          <Text style={[styles.cardCopy, { color: theme.muted }]}>{activeFlow ? `Run ${activeFlow.name} for project conversations.` : 'No published flow is available for this project.'}</Text>
          <Text style={[styles.open, { color: flowEnabled ? theme.emerald : theme.muted }]}>{flowEnabled ? 'Enabled' : activeFlow ? 'Disabled' : 'Publish a flow from the web builder'}</Text>
          <Text style={[styles.open, { color: theme.emerald }]}>Open Flow Builder</Text>
        </Pressable>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardTop}><View style={[styles.iconBox, { backgroundColor: theme.mint }]}><MessageSquare color={theme.emerald} /></View><Switch value={autoReply} disabled={updating === 'reply'} onValueChange={toggleReply} trackColor={{ false: theme.border, true: theme.emerald }} /></View>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Auto Reply</Text><Text style={[styles.cardCopy, { color: theme.muted }]}>Send automatic replies to all conversations or only new conversation starts.</Text>
          {autoReply && <View style={styles.replyOptions}>
            <Option label="All conversations" selected={replyType === 'all'} onPress={() => changeReplyType('all')} disabled={updating === 'type'} theme={theme} />
            <Option label="New conversations only" selected={replyType === 'new'} onPress={() => changeReplyType('new')} disabled={updating === 'type'} theme={theme} />
          </View>}
        </View>
        <NavigationCard icon={<Bot color="#7C3AED" />} title="Agent Configuration" description="Manage provider and personal API key settings." onPress={onOpenAgent} theme={theme} />
        <NavigationCard icon={<Shield color="#0284C7" />} title="Company Context" description="Update the company context used by the bot to answer FAQs and support queries." onPress={onOpenContext} theme={theme} />
        <Text style={[styles.sectionLabel, { color: theme.muted }]}>COMING SOON</Text>
        <ComingSoon icon={<Bell color={theme.muted} />} title="Notification Preferences" description="Choose how and when you get notified for new messages." theme={theme} />
        <ComingSoon icon={<FileText color={theme.muted} />} title="Analytics & Reports" description="Enable dashboards and scheduled reports." theme={theme} />
        <ComingSoon icon={<UserCheck color={theme.muted} />} title="Agent Assignment Rules" description="Auto-assign chats to agents by rules." theme={theme} />
      </ScrollView></FadeInView>}
  </View>;
}

function ConfigCard({ icon, title, description, right, theme }: { icon: React.ReactNode; title: string; description: string; right: React.ReactNode; theme: any }) { return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.cardTop}><View style={[styles.iconBox, { backgroundColor: theme.mint }]}>{icon}</View>{right}</View><Text style={[styles.cardTitle, { color: theme.ink }]}>{title}</Text><Text style={[styles.cardCopy, { color: theme.muted }]}>{description}</Text></View>; }
function NavigationCard({ icon, title, description, onPress, theme }: { icon: React.ReactNode; title: string; description: string; onPress: () => void; theme: any }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && { backgroundColor: theme.cardHover }]}><View style={styles.cardTop}><View style={[styles.iconBox, { backgroundColor: theme.canvas }]}>{icon}</View><ChevronRight color={theme.muted} /></View><Text style={[styles.cardTitle, { color: theme.ink }]}>{title}</Text><Text style={[styles.cardCopy, { color: theme.muted }]}>{description}</Text><Text style={[styles.open, { color: theme.emerald }]}>Open settings</Text></Pressable>; }
function ComingSoon({ icon, title, description, theme }: { icon: React.ReactNode; title: string; description: string; theme: any }) { return <View style={[styles.card, styles.disabledCard, { backgroundColor: theme.cardHover, borderColor: theme.border }]}><View style={styles.cardTop}><View style={styles.iconBox}>{icon}</View><Text style={[styles.soon, { color: theme.muted }]}>Coming soon</Text></View><Text style={[styles.cardTitle, { color: theme.muted }]}>{title}</Text><Text style={[styles.cardCopy, { color: theme.muted }]}>{description}</Text></View>; }
function Option({ label, selected, onPress, disabled, theme }: { label: string; selected: boolean; onPress: () => void; disabled: boolean; theme: any }) { return <Pressable disabled={disabled} onPress={onPress} style={styles.option}><View style={[styles.radio, { borderColor: selected ? theme.emerald : theme.border }]}>{selected && <View style={[styles.radioDot, { backgroundColor: theme.emerald }]} />}</View><Text style={[styles.optionText, { color: theme.ink }]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({ safe: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, headerTitle: { fontSize: 18, fontWeight: '800' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, page: { padding: 16, paddingBottom: 36 }, intro: { flexDirection: 'row', gap: 12, marginBottom: 20 }, introCopy: { flex: 1 }, title: { fontSize: 22, fontWeight: '800' }, copy: { fontSize: 14, marginTop: 3 }, card: { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 12 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, iconBox: { padding: 10, borderRadius: 12 }, cardTitle: { fontSize: 16, fontWeight: '800', marginTop: 15 }, cardCopy: { fontSize: 14, lineHeight: 20, marginTop: 5 }, replyOptions: { marginTop: 14, gap: 12 }, option: { flexDirection: 'row', alignItems: 'center', gap: 9 }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, radioDot: { width: 8, height: 8, borderRadius: 4 }, optionText: { fontSize: 14 }, open: { fontSize: 13, fontWeight: '700', marginTop: 14 }, sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginBottom: 8 }, disabledCard: { opacity: 0.7 }, soon: { fontSize: 11, fontWeight: '700' } });
