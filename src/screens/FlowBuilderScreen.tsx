import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
  import { Animated } from 'react-native';
import Svg, { Defs, Line, Marker, Path } from 'react-native-svg';
import {
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  GitBranch,
  GitMerge,
  Link,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  StopCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react-native';
import Toast from '../ui/toast';
import { ScreenSkeleton } from '../components/Skeleton';
import { ApiSession } from '../api/client';
import {
  createFlow,
  getFlow,
  getFlowStatus,
  listFlows,
  publishFlow,
  setFlowEnabled,
  updateFlowDraft,
  validateFlow,
} from '../api/flowBuilder';
import { useTheme } from '../theme/theme';
import { useKeyboardContext } from '../contexts/KeyboardContext';
type Props = {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
  initialFlowId?: string;
};
type Node = {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data: Record<string, any>;
};
type Edge = { id: string; source: string; target: string };
type Graph = { version: number; nodes: Node[]; edges: Edge[] };
const emptyGraph = (): Graph => ({
  version: 1,
  nodes: [{ id: 'start', type: 'start', position: { x: 40, y: 40 }, data: {} }],
  edges: [],
});
const tools = [
  { type: 'message', label: 'Message', Icon: MessageSquare },
  { type: 'keyword', label: 'Keyword', Icon: GitBranch },
  { type: 'condition', label: 'Condition', Icon: GitMerge },
  { type: 'end', label: 'End', Icon: Flag },
  { type: 'stop', label: 'Stop', Icon: StopCircle },
];

export function FlowBuilderScreen({
  projectId,
  session,
  onBack,
  initialFlowId,
}: Props) {
  const theme = useTheme();
  const { keyboardHeightAnim } = useKeyboardContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flows, setFlows] = useState<any[]>([]);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [name, setName] = useState('New Flow');
  const [graph, setGraph] = useState<Graph>(emptyGraph);
  const [selected, setSelected] = useState('start');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [past, setPast] = useState<Graph[]>([]);
  const [future, setFuture] = useState<Graph[]>([]);
  const [zoom, setZoom] = useState(1);
  const [optionsJson, setOptionsJson] = useState('[]');
  const selectedNode = useMemo(
    () => graph.nodes.find(node => node.id === selected),
    [graph.nodes, selected],
  );
  useEffect(() => {
    if (selectedNode?.type === 'message') {
      setOptionsJson(JSON.stringify(selectedNode.data.items || [], null, 2));
    } else {
      setOptionsJson('[]');
    }
  }, [selected]);
  const pos = (node: Node, index: number) =>
    node.position || { x: 40, y: 40 + index * 170 };
  const dragResponder = (node: Node, index: number) => {
    let origin = pos(node, index);
    let before: Graph | null = null;
    let moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 1,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        origin = pos(node, index);
        before = graph;
        moved = false;
        setSelected(node.id);
      },
      onPanResponderMove: (_, gesture) => {
        moved = true;
        setGraph(current => ({
          ...current,
          nodes: current.nodes.map(item =>
            item.id === node.id
              ? {
                  ...item,
                  position: {
                    x: Math.max(10, origin.x + gesture.dx / zoom),
                    y: Math.max(10, origin.y + gesture.dy / zoom),
                  },
                }
              : item,
          ),
        }));
      },
      onPanResponderRelease: () => {
        if (moved && before) {
          setPast(items => [...items, before as Graph].slice(-50));
          setFuture([]);
        }
      },
    });
  };
  const width = Math.max(
    900,
    ...graph.nodes.map((node, index) => pos(node, index).x + 230),
  );
  const height = Math.max(
    700,
    ...graph.nodes.map((node, index) => pos(node, index).y + 180),
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [status, list] = await Promise.all([
        getFlowStatus(session, projectId),
        listFlows(session, projectId),
      ]);
      setEnabled(Boolean(status.flow_builder_enabled));
      setFlows(Array.isArray(list.data) ? list.data : []);
      const id =
        initialFlowId || status.active_flow?.flow_id || list.data?.[0]?.flow_id;
      if (id) {
        const item = await getFlow(session, projectId, id);
        setFlowId(id);
        setName(item.data.name);
        setGraph(item.data.draft || emptyGraph());
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not load flows',
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [initialFlowId, projectId, session]);
  useEffect(() => {
    load();
  }, [load]);
  const commit = (next: Graph | ((current: Graph) => Graph)) =>
    setGraph(current => {
      const value = typeof next === 'function' ? next(current) : next;
      setPast(items => [...items, current].slice(-50));
      setFuture([]);
      return value;
    });
  const undo = () =>
    setPast(items => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture(values => [graph, ...values].slice(0, 50));
      setGraph(previous);
      return items.slice(0, -1);
    });
  const redo = () =>
    setFuture(items => {
      if (!items.length) return items;
      const next = items[0];
      setPast(values => [...values, graph].slice(-50));
      setGraph(next);
      return items.slice(1);
    });
  const addNode = (type: string) => {
    const id = `${type}-${Date.now()}`;
    const data =
      type === 'message'
        ? {
            text: 'Thanks for contacting us.',
            interactive: false,
            interactiveType: 'list',
            items: [
              { id: 'option_1', title: 'Yes' },
              { id: 'option_2', title: 'No' },
            ],
          }
        : type === 'keyword' || type === 'condition'
        ? { value: type === 'keyword' ? 'hello' : 'yes', match: 'contains' }
        : {};
    commit(current => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          id,
          type,
          data,
          position: { x: 300, y: 60 + current.nodes.length * 150 },
        },
      ],
    }));
    setSelected(id);
  };
  const toolDragResponder = (type: string) => {
    let moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
      onPanResponderGrant: () => {
        moved = false;
      },
      onPanResponderMove: () => {
        moved = true;
      },
      onPanResponderRelease: () => {
        if (moved) addNode(type);
      },
      onPanResponderTerminate: () => {
        moved = false;
      },
    });
  };
  const connectNode = (id: string) => {
    if (!connectFrom) {
      setConnectFrom(id);
      setSelected(id);
      return;
    }
    if (connectFrom !== id)
      commit(current =>
        current.edges.some(
          edge => edge.source === connectFrom && edge.target === id,
        )
          ? current
          : {
              ...current,
              edges: [
                ...current.edges,
                { id: `edge-${Date.now()}`, source: connectFrom, target: id },
              ],
            },
      );
    setConnectFrom(null);
    setSelected(id);
  };
  const update = (field: string, value: any) =>
    commit(current => ({
      ...current,
      nodes: current.nodes.map(node =>
        node.id === selected
          ? { ...node, data: { ...node.data, [field]: value } }
          : node,
      ),
    }));
  const remove = (id: string) => {
    if (id === 'start') return;
    commit(current => ({
      ...current,
      nodes: current.nodes.filter(node => node.id !== id),
      edges: current.edges.filter(
        edge => edge.source !== id && edge.target !== id,
      ),
    }));
    if (selected === id) setSelected('start');
    if (connectFrom === id) setConnectFrom(null);
  };
  const newFlow = () => {
    setFlowId(null);
    setName('New Flow');
    setGraph(emptyGraph());
    setSelected('start');
    setConnectFrom(null);
    setPast([]);
    setFuture([]);
  };
  const openFlow = async (id: string) => {
    const result = await getFlow(session, projectId, id);
    if (result.error) return;
    setFlowId(id);
    setName(result.data.name);
    setGraph(result.data.draft || emptyGraph());
    setSelected('start');
    setConnectFrom(null);
    setPast([]);
    setFuture([]);
  };
  const save = async () => {
    setSaving(true);
    try {
      let id = flowId;
      if (!id) {
        const result = await createFlow(session, projectId, name, graph);
        if (result.error) throw new Error(String(result.error));
        id = result.data.flow_id;
        setFlowId(id);
      } else {
        const result = await updateFlowDraft(
          session,
          projectId,
          id,
          name,
          graph,
        );
        if (result.error) throw new Error(String(result.error));
      }
      Toast.show({ type: 'success', text1: 'Draft saved' });
      await load();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not save draft',
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const publish = async () => {
    if (!flowId)
      return Toast.show({ type: 'error', text1: 'Save the flow first' });
    setSaving(true);
    try {
      const check = await validateFlow(session, projectId, graph);
      if (!check.valid) throw new Error((check.errors || []).join(', '));
      await updateFlowDraft(session, projectId, flowId, name, graph);
      const result = await publishFlow(session, projectId, flowId);
      if (result.error) throw new Error(String(result.error));
      Toast.show({ type: 'success', text1: 'Flow published' });
      await load();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not publish flow',
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (value: boolean) => {
    if (!flowId) return;
    const result = await setFlowEnabled(session, projectId, flowId, value);
    if (!result.error) setEnabled(value);
  };
  return (
    <Animated.View
      style={[
        s.safe,
        { backgroundColor: theme.canvas, paddingBottom: keyboardHeightAnim },
      ]}
    >
      <View
        style={[
          s.header,
          { backgroundColor: theme.header, borderBottomColor: theme.border },
        ]}
      >
        <Pressable onPress={onBack} style={s.icon}>
          <ArrowLeft color={theme.ink} size={24} />
        </Pressable>
        <Text style={[s.headerTitle, { color: theme.ink }]}>Flow Builder</Text>
        <Pressable onPress={load} style={s.icon}>
          <RefreshCw color={theme.ink} size={19} />
        </Pressable>
      </View>
      {loading ? (
        <ScreenSkeleton variant="form" />
      ) : (
        <ScrollView
          contentContainerStyle={s.page}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.top}>
            <View>
              <Text style={[s.title, { color: theme.ink }]}>
                Build project conversations
              </Text>
              <Text style={[s.copy, { color: theme.muted }]}>
                Add tools and connect steps on the canvas.
              </Text>
            </View>
            <Switch
              value={enabled}
              disabled={!flowId}
              onValueChange={toggle}
              trackColor={{ false: theme.border, true: theme.emerald }}
            />
          </View>
          <View style={s.actions}>
            <Pressable
              onPress={save}
              disabled={saving}
              style={[s.action, { backgroundColor: theme.emerald }]}
            >
              <Save color="#FFF" size={17} />
              <Text style={s.actionText}>Save</Text>
            </Pressable>
            <Pressable
              onPress={publish}
              disabled={saving}
              style={[s.action, { backgroundColor: theme.ink }]}
            >
              <UploadCloud color={theme.canvas} size={17} />
              <Text style={[s.actionText, { color: theme.canvas }]}>
                Publish
              </Text>
            </Pressable>
            <Pressable
              onPress={newFlow}
              style={[
                s.action,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Plus color={theme.ink} size={17} />
              <Text style={[s.actionText, { color: theme.ink }]}>New</Text>
            </Pressable>
            <Pressable
              onPress={undo}
              disabled={!past.length}
              style={[
                s.small,
                { borderColor: theme.border, opacity: past.length ? 1 : 0.35 },
              ]}
            >
              <CornerUpLeft color={theme.ink} size={17} />
            </Pressable>
            <Pressable
              onPress={redo}
              disabled={!future.length}
              style={[
                s.small,
                {
                  borderColor: theme.border,
                  opacity: future.length ? 1 : 0.35,
                },
              ]}
            >
              <CornerUpRight color={theme.ink} size={17} />
            </Pressable>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[
              s.name,
              {
                color: theme.ink,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            placeholder="Flow name"
            placeholderTextColor={theme.muted}
          />
          {flows.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabs}
            >
              {flows.map(flow => (
                <Pressable
                  key={flow.flow_id}
                  onPress={() => openFlow(flow.flow_id)}
                  style={[
                    s.tab,
                    {
                      backgroundColor:
                        flow.flow_id === flowId ? theme.emerald : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: flow.flow_id === flowId ? '#FFF' : theme.ink,
                      fontWeight: '700',
                    }}
                  >
                    {flow.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Text style={[s.section, { color: theme.ink }]}>Add tools</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tools}
          >
            {tools.map(({ type, label, Icon }) => (
              <Pressable
                key={type}
                onPress={() => addNode(type)}
                {...toolDragResponder(type).panHandlers}
                style={[
                  s.tool,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Icon color={theme.emerald} />
                <Text style={[s.toolText, { color: theme.ink }]}>{label}</Text>
                <Text style={[s.hint, { color: theme.muted }]}>Tap to add</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[s.section, { color: theme.ink }]}>Flow canvas</Text>
          <View style={s.zoomBar}>
            <Text style={[s.hint, { color: theme.muted }]}>
              Canvas {Math.round(zoom * 100)}%
            </Text>
            <Pressable
              onPress={() =>
                setZoom(value =>
                  Math.max(0.5, Number((value - 0.1).toFixed(2))),
                )
              }
              style={s.zoomButton}
            >
              <Text style={{ color: theme.ink }}>−</Text>
            </Pressable>
            <Pressable onPress={() => setZoom(1)} style={s.zoomButton}>
              <Text style={{ color: theme.ink }}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setZoom(value => Math.min(2, Number((value + 0.1).toFixed(2))))
              }
              style={s.zoomButton}
            >
              <Text style={{ color: theme.ink }}>+</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              contentContainerStyle={{
                width: width * zoom,
                height: height * zoom,
              }}
            >
              <View
                style={[
                  s.canvas,
                  {
                    width,
                    height,
                    backgroundColor: theme.canvas,
                    transform: [{ scale: zoom }],
                    transformOrigin: 'top left',
                  },
                ]}
              >
                <Svg
                  width={width}
                  height={height}
                  style={StyleSheet.absoluteFill}
                >
                  <Defs>
                    <Marker
                      id="arrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="3"
                      orient="auto"
                    >
                      <Path d="M0,0 L0,6 L6,3 z" fill={theme.emerald} />
                    </Marker>
                  </Defs>
                  {graph.edges.map(edge => {
                    const a = graph.nodes.find(node => node.id === edge.source);
                    const b = graph.nodes.find(node => node.id === edge.target);
                    if (!a || !b) return null;
                    const p = pos(a, graph.nodes.indexOf(a));
                    const q = pos(b, graph.nodes.indexOf(b));
                    return (
                      <Line
                        key={edge.id}
                        x1={p.x + 100}
                        y1={p.y + 125}
                        x2={q.x + 100}
                        y2={q.y}
                        stroke={theme.emerald}
                        strokeWidth="2.5"
                        markerEnd="url(#arrow)"
                      />
                    );
                  })}
                </Svg>
                {graph.nodes.map((node, index) => {
                  const p = pos(node, index);
                  return (
                    <View
                      key={node.id}
                      {...dragResponder(node, index).panHandlers}
                      style={[
                        s.node,
                        {
                          left: p.x,
                          top: p.y,
                          backgroundColor: theme.surface,
                          borderColor:
                            selected === node.id
                              ? theme.emerald
                              : connectFrom === node.id
                              ? '#F59E0B'
                              : theme.border,
                        },
                      ]}
                    >
                      <Pressable onPress={() => setSelected(node.id)}>
                        <View style={s.nodeHead}>
                          <Text style={[s.nodeType, { color: theme.emerald }]}>
                            {node.type.toUpperCase()}
                          </Text>
                          {node.type !== 'start' && (
                            <Pressable
                              onPress={() => remove(node.id)}
                              onPressIn={event => event.stopPropagation()}
                              hitSlop={10}
                            >
                              <Trash2 color={theme.danger} size={17} />
                            </Pressable>
                          )}
                        </View>
                        <Text
                          numberOfLines={3}
                          style={[s.nodeText, { color: theme.ink }]}
                        >
                          {node.type === 'message'
                            ? node.data.text
                            : node.type === 'keyword' ||
                              node.type === 'condition'
                            ? `Match: ${node.data.value}`
                            : node.type === 'start'
                            ? 'Flow entry point'
                            : 'End automation'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => connectNode(node.id)}
                        style={[
                          s.connect,
                          {
                            backgroundColor:
                              connectFrom === node.id
                                ? theme.emerald
                                : theme.canvas,
                          },
                        ]}
                      >
                        <Link
                          color={
                            connectFrom === node.id ? '#FFF' : theme.emerald
                          }
                          size={14}
                        />
                        <Text
                          style={{
                            color: connectFrom === node.id ? '#FFF' : theme.ink,
                            fontSize: 10,
                            fontWeight: '800',
                          }}
                        >
                          {connectFrom === node.id
                            ? 'Choose target'
                            : 'Connect'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
          <Text style={[s.hint, { color: theme.muted }]}>
            {connectFrom
              ? 'Tap another node to create a connection.'
              : 'Swipe horizontally and vertically to explore the canvas.'}
          </Text>
          <Text style={[s.section, { color: theme.ink }]}>Node settings</Text>
          {selectedNode ? (
            <View
              style={[
                s.settings,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[s.nodeType, { color: theme.emerald }]}>
                {selectedNode.type.toUpperCase()}
              </Text>
              {selectedNode.type === 'message' && (
                <>
                  <TextInput
                    multiline
                    value={selectedNode.data.text || ''}
                    onChangeText={value => update('text', value)}
                    style={[
                      s.editor,
                      {
                        color: theme.ink,
                        borderColor: theme.border,
                        backgroundColor: theme.canvas,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={() =>
                      update('interactive', !selectedNode.data.interactive)
                    }
                    style={s.check}
                  >
                    <View
                      style={[
                        s.box,
                        {
                          borderColor: selectedNode.data.interactive
                            ? theme.emerald
                            : theme.border,
                          backgroundColor: selectedNode.data.interactive
                            ? theme.emerald
                            : 'transparent',
                        },
                      ]}
                    />
                    <Text style={[s.copy, { color: theme.ink }]}>
                      Interactive options
                    </Text>
                  </Pressable>
                  {selectedNode.data.interactive && (
                    <>
                      <Text style={[s.fieldLabel, { color: theme.muted }]}>Interactive type</Text>
                      <View style={s.typePicker}>
                        {[
                          { value: 'button', label: 'Reply buttons' },
                          { value: 'list', label: 'List menu' },
                        ].map(option => (
                          <Pressable
                            key={option.value}
                            onPress={() => update('interactiveType', option.value)}
                            style={[
                              s.typeOption,
                              {
                                backgroundColor:
                                  (selectedNode.data.interactiveType || 'list') === option.value
                                    ? theme.emerald
                                    : theme.canvas,
                                borderColor: theme.border,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color:
                                  (selectedNode.data.interactiveType || 'list') === option.value
                                    ? '#FFF'
                                    : theme.ink,
                                fontSize: 12,
                                fontWeight: '700',
                              }}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={[s.fieldLabel, { color: theme.muted }]}>Options JSON</Text>
                      <TextInput
                        multiline
                        value={optionsJson}
                        onChangeText={value => {
                          setOptionsJson(value);
                          try {
                            const items = JSON.parse(value);
                            if (Array.isArray(items)) update('items', items);
                          } catch {
                            // Keep the draft visible until the JSON is valid.
                          }
                        }}
                        style={[
                          s.optionsEditor,
                          {
                            color: theme.ink,
                            borderColor: theme.border,
                            backgroundColor: theme.canvas,
                          },
                        ]}
                        textAlignVertical="top"
                      />
                      <Text style={[s.hint, { color: theme.muted }]}> 
                        Use objects with id, title, and optional description. List messages may also use sections.
                      </Text>
                    </>
                  )}
                </>
              )}
              {(selectedNode.type === 'keyword' ||
                selectedNode.type === 'condition') && (
                <TextInput
                  value={selectedNode.data.value || ''}
                  onChangeText={value => update('value', value)}
                  style={[
                    s.editor,
                    {
                      color: theme.ink,
                      borderColor: theme.border,
                      backgroundColor: theme.canvas,
                    },
                  ]}
                />
              )}
              {selectedNode.type !== 'start' && (
                <Pressable
                  onPress={() => remove(selectedNode.id)}
                  style={s.delete}
                >
                  <Trash2 color={theme.danger} size={16} />
                  <Text style={{ color: theme.danger, fontWeight: '700' }}>
                    Delete node
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </Animated.View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { padding: 16, paddingBottom: 40 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 21, fontWeight: '800' },
  copy: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 15,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  small: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
    fontSize: 15,
  },
  tabs: { gap: 8, paddingVertical: 10 },
  tab: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  section: { fontSize: 16, fontWeight: '800', marginTop: 19, marginBottom: 9 },
  tools: { gap: 8, paddingBottom: 3 },
  tool: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 5,
    minWidth: 86,
  },
  toolText: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 11 },
  zoomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  zoomButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  canvas: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  node: {
    position: 'absolute',
    width: 200,
    minHeight: 125,
    borderWidth: 1.5,
    borderRadius: 13,
    padding: 11,
    elevation: 2,
  },
  nodeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeType: { fontSize: 11, fontWeight: '900' },
  nodeText: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 7,
    paddingVertical: 6,
    marginTop: 9,
  },
  settings: { borderWidth: 1, borderRadius: 14, padding: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  typePicker: { flexDirection: 'row', gap: 8, marginTop: 6 },
  typeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsEditor: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 10,
    minHeight: 130,
    marginTop: 6,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  editor: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 10,
    minHeight: 45,
    marginTop: 8,
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  box: { width: 18, height: 18, borderWidth: 2, borderRadius: 4 },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
});
