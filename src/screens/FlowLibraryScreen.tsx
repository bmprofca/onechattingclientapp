import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {ArrowLeft, CheckCircle, Circle, Edit3, GitBranch, Plus, RefreshCw, Trash2, X, Zap} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {ApiSession} from '../api/client';
import {deleteFlows, getFlowStatus, listFlows} from '../api/flowBuilder';
import {useTheme} from '../theme/theme';

type Props = {projectId: string; session: ApiSession; onBack: () => void; onOpenFlow: (flowId?: string) => void};

export function FlowLibraryScreen({projectId, session, onBack, onOpenFlow}: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [flows, setFlows] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, status] = await Promise.all([listFlows(session, projectId), getFlowStatus(session, projectId)]);
      setFlows(Array.isArray(list.data) ? list.data : []);
      setActiveId(status.active_flow?.flow_id || null);
    } catch (e) {
      Toast.show({type: 'error', text1: 'Could not load flows', text2: e instanceof Error ? e.message : undefined});
    } finally {
      setLoading(false);
    }
  }, [projectId, session]);

  useEffect(() => { load(); }, [load]);

  const groups = ['published', 'draft', 'archived'];

  const enterSelectMode = (flowId: string) => {
    setSelectMode(true);
    setSelected(new Set([flowId]));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (flowId: string) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(flowId)) next.delete(flowId); else next.add(flowId);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  };

  const handlePress = (flow: any) => {
    if (selectMode) toggleSelect(flow.flow_id);
    else onOpenFlow(flow.flow_id);
  };

  const handleLongPress = (flow: any) => {
    if (!selectMode) enterSelectMode(flow.flow_id);
  };

  const confirmDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    Alert.alert(
      ids.length > 1 ? `Delete ${ids.length} flows?` : 'Delete flow?',
      'This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: () => runDelete(ids)},
      ],
    );
  };

  const runDelete = async (ids: string[]) => {
    setDeleting(true);
    try {
      const result = await deleteFlows(session, projectId, ids);
      if (result?.error) throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete');
      Toast.show({type: 'success', text1: ids.length > 1 ? `${ids.length} flows deleted` : 'Flow deleted'});
      exitSelectMode();
      await load();
    } catch (e) {
      Toast.show({type: 'error', text1: 'Failed to delete', text2: e instanceof Error ? e.message : undefined});
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.safe, {backgroundColor: theme.canvas}]}>
      <View style={[styles.header, {backgroundColor: theme.header, borderBottomColor: theme.border}]}>
        {selectMode ? (
          <>
            <Pressable onPress={exitSelectMode} style={styles.icon}><X color={theme.ink} size={22} /></Pressable>
            <Text style={[styles.headerTitle, {color: theme.ink}]}>{selected.size} selected</Text>
            <Pressable onPress={confirmDelete} style={styles.icon} disabled={deleting || selected.size === 0}>
              <Trash2 color={selected.size === 0 ? theme.muted : '#DC2626'} size={20} />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={onBack} style={styles.icon}><ArrowLeft color={theme.ink} size={24} /></Pressable>
            <Text style={[styles.headerTitle, {color: theme.ink}]}>Flow Library</Text>
            <Pressable onPress={load} style={styles.icon}><RefreshCw color={theme.ink} size={19} /></Pressable>
          </>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.emerald} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          {!selectMode && (
            <>
              <View style={styles.hero}>
                <GitBranch color={theme.emerald} size={30} />
                <Text style={[styles.title, {color: theme.ink}]}>Project flows</Text>
                <Text style={[styles.copy, {color: theme.muted}]}>Manage published and draft conversation flows.</Text>
              </View>
              <Pressable onPress={() => onOpenFlow()} style={[styles.newButton, {backgroundColor: theme.emerald}]}>
                <Plus color="#FFF" size={18} />
                <Text style={styles.newText}>Create new flow</Text>
              </Pressable>
              <Text style={[styles.hint, {color: theme.muted}]}>Press and hold a flow to select multiple.</Text>
            </>
          )}

          {groups.map(group => {
            const items = flows.filter(flow => flow.status === group);
            return (
              <View key={group}>
                <Text style={[styles.section, {color: theme.ink}]}>{group[0].toUpperCase() + group.slice(1)} ({items.length})</Text>
                {items.length === 0 ? (
                  <Text style={[styles.empty, {color: theme.muted}]}>No {group} flows.</Text>
                ) : (
                  items.map(flow => {
                    const isSelected = selected.has(flow.flow_id);
                    return (
                      <Pressable
                        key={flow.flow_id}
                        onPress={() => handlePress(flow)}
                        onLongPress={() => handleLongPress(flow)}
                        style={[
                          styles.card,
                          {backgroundColor: theme.surface, borderColor: isSelected ? theme.emerald : theme.border, borderWidth: isSelected ? 2 : 1},
                        ]}>
                        {selectMode && (
                          <View style={styles.checkbox}>
                            {isSelected ? <CheckCircle color={theme.emerald} size={22} /> : <Circle color={theme.muted} size={22} />}
                          </View>
                        )}
                        <View style={{flex: 1}}>
                          <Text style={[styles.cardTitle, {color: theme.ink}]}>{flow.name}</Text>
                          <Text style={[styles.copy, {color: theme.muted}]}>Version {flow.version}</Text>
                          {activeId === flow.flow_id && (
                            <Text style={[styles.active, {color: theme.emerald}]}><Zap size={13} /> Active flow</Text>
                          )}
                        </View>
                        {!selectMode && (
                          <Pressable onPress={() => onOpenFlow(flow.flow_id)} style={styles.edit}>
                            <Edit3 color={theme.emerald} size={18} />
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1},
  icon: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '800'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  page: {padding: 16, paddingBottom: 36},
  hero: {alignItems: 'center', marginBottom: 18},
  title: {fontSize: 22, fontWeight: '800', marginTop: 8},
  copy: {fontSize: 13, lineHeight: 19, marginTop: 4},
  newButton: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 13, borderRadius: 11, marginBottom: 10},
  newText: {color: '#FFF', fontWeight: '800'},
  hint: {fontSize: 12, textAlign: 'center', marginBottom: 16},
  section: {fontSize: 16, fontWeight: '800', marginTop: 13, marginBottom: 8},
  empty: {fontSize: 13, marginBottom: 5},
  card: {borderRadius: 14, padding: 15, marginBottom: 9, flexDirection: 'row', alignItems: 'center'},
  checkbox: {marginRight: 12},
  cardTitle: {fontSize: 15, fontWeight: '800'},
  active: {fontSize: 12, fontWeight: '800', marginTop: 8},
  edit: {padding: 10},
});