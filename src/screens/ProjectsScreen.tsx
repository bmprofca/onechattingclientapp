import React, { useEffect, useState } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Settings, Plus, ArrowLeft } from 'lucide-react-native';
import { Project } from '../api/auth';
import { ApiSession } from '../api/client';
import { useTheme } from '../theme/theme';
import { CreateProjectScreen } from './CreateProjectScreen';
import { ManageProjectScreen } from './ManageProjectScreen';

type Mode = 'list' | 'create' | 'manage';

export function ProjectsScreen({
  session,
  projects,
  onSelect,
  onProjectCreated,
  onClose,
  onRechargeWallet,
}: {
  session: ApiSession;
  projects: Project[];
  onSelect: (projectId: string) => void | Promise<void>;
  onProjectCreated: (newProject: Project) => void | Promise<void>;
  onClose?: () => void;
  onRechargeWallet?: () => void;
}) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('list');
  const [manageProjectId, setManageProjectId] = useState<string | null>(null);

  useEffect(() => {
    const handleBackPress = () => {
      if (mode === 'create') {
        setMode('list');
        return true;
      }
      if (mode === 'manage') {
        setMode('list');
        setManageProjectId(null);
        return true;
      }
      if (onClose) {
        onClose();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [mode, onClose]);

  if (mode === 'create') {
    return (
      <CreateProjectScreen
        session={session}
        onBack={() => setMode('list')}
        onCreated={(proj) => {
          setMode('list');
          onProjectCreated(proj);
        }}
        onRechargeWallet={onRechargeWallet}
      />
    );
  }

  if (mode === 'manage' && manageProjectId) {
    return (
      <ManageProjectScreen
        session={session}
        projectId={manageProjectId}
        onBack={() => {
          setMode('list');
          setManageProjectId(null);
        }}
      />
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {/* Header if onClose is provided (e.g., when launched from Dashboard) */}
      {onClose && projects.length > 0 && (
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={8}>
            <ArrowLeft size={24} color={theme.ink} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>Workspaces</Text>
          <View style={styles.headerRight} />
        </View>
      )}

      <FlatList
        data={projects}
        keyExtractor={(project) => project.id}
        contentContainerStyle={styles.page}
        ListHeaderComponent={
          <>
            <Text style={[styles.eyebrow, { color: theme.mintText }]}>YOUR WORKSPACES</Text>

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.ink }]}>Projects</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode('create')}
                style={[styles.createBtn, { backgroundColor: theme.emerald }]}
              >
                <Plus size={16} color="#FFF" strokeWidth={3} />
                <Text style={styles.createBtnText}>New</Text>
              </Pressable>
            </View>

            {projects.length > 0 ? (
              <Text style={[styles.copy, { color: theme.muted }]}>
                Select a project to open its workspace, or tap the gear icon to manage settings.
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.ink }]}>No projects yet</Text>
            <Text style={[styles.emptyCopy, { color: theme.muted }]}>
              You don't have any workspaces. Create one to start using 1chatting.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('create')}
              style={[styles.primaryButton, { backgroundColor: theme.emerald }]}
            >
              <Text style={styles.primaryButtonText}>Create your first project</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => { void onSelect(item.id); }}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
              pressed && { backgroundColor: theme.cardHover },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: theme.mint }]}>
              <Text style={[styles.iconText, { color: theme.mintText }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.cardText}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>
                {item.name}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {item.owned ? 'Owned by you' : item.ownerName || 'Shared workspace'}
              </Text>
            </View>

            <Pressable
              hitSlop={12}
              style={styles.manageBtn}
              onPress={() => {
                setManageProjectId(item.id);
                setMode('manage');
              }}
            >
              <Settings size={20} color={theme.muted} />
            </Pressable>

          </Pressable>
        )}
      />
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
  page: { padding: 22, paddingBottom: 32, flexGrow: 1 },
  logo: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 25, fontWeight: '900' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.7 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  createBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  copy: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 },

  card: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  icon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontWeight: '900', fontSize: 17 },
  cardText: { flex: 1, marginLeft: 12, marginRight: 8 },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 4 },

  manageBtn: {
    padding: 8,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 20,
  },
  emptyCopy: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: 20,
    marginTop: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
