import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Plus,
  ArrowLeft,
  QrCode,
  Briefcase,
  Search,
  Shield,
  UserCheck,
  Eye,
} from 'lucide-react-native';
import { Project } from '../api/auth';
import { ApiSession } from '../api/client';
import { useTheme } from '../theme/theme';
import { CreateProjectScreen } from './CreateProjectScreen';
import { ManageProjectScreen } from './ManageProjectScreen';
import { ProjectAvatar } from '../components/ProjectAvatar';
import { ProjectQRModal } from '../components/Modals/ProjectQRModal';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';

type Mode = 'list' | 'create' | 'manage';

// --- Skeleton Components ---
function SkeletonBar({ width, height = 14, style }: { width?: number | string; height?: number; style?: any }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          height,
          width: width || '100%',
          backgroundColor: theme.border,
          borderRadius: 6,
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

function ProjectCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.skeletonAvatar, { backgroundColor: theme.border }]} />
      <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
        <SkeletonBar width="60%" height={14} />
        <SkeletonBar width="40%" height={11} />
      </View>
      <View style={{ gap: 8, flexDirection: 'row' }}>
        <View style={[styles.actionBtn, { backgroundColor: theme.border }]} />
        <View style={[styles.actionBtn, { backgroundColor: theme.border }]} />
      </View>
    </View>
  );
}

function ProjectsSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
      {/* Search bar skeleton */}
      <SkeletonBar height={46} style={{ borderRadius: 14, marginBottom: 16 }} />
      {/* Stats row skeleton */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border, flex: 1 }]}>
            <SkeletonBar width={40} height={11} />
            <SkeletonBar width={24} height={22} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      {/* Card skeletons */}
      {[1, 2, 3].map(i => <ProjectCardSkeleton key={i} />)}
    </View>
  );
}

export function ProjectsScreen({
  session,
  projects,
  currentProjectId,
  onSelect,
  onProjectCreated,
  onClose,
  onRechargeWallet,
  onOpenWaba,
  loadingProjects,
}: {
  session: ApiSession;
  projects: Project[];
  currentProjectId?: string;
  onSelect: (projectId: string) => void | Promise<void>;
  onProjectCreated: (newProject: Project) => void | Promise<void>;
  onClose?: () => void;
  onRechargeWallet?: () => void;
  onOpenWaba?: () => void;
  loadingProjects?: boolean;
}) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('list');
  const [manageProjectId, setManageProjectId] = useState<string | null>(null);
  const [qrProject, setQrProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
        onOpenWaba={onOpenWaba}
      />
    );
  }

  // Filter projects by search term, then sort: active project always first
  const filteredProjects = projects
    .filter(p => {
      const term = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        ((p as any).ownerName || (p as any).owner_name || '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (a.id === currentProjectId) return -1;
      if (b.id === currentProjectId) return 1;
      return 0;
    });

  const ownedCount = filteredProjects.filter(p => p.owned === true).length;
  const sharedCount = filteredProjects.filter(p => p.owned === false).length;

  const hasProjects = projects.length > 0;

  return (
    <KeyboardAvoidView style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {/* Header (when launched from Dashboard) */}
      {onClose && (
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={8}>
            <ArrowLeft size={24} color={theme.ink} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>Projects</Text>
          <View style={styles.headerRight} />
        </View>
      )}

      {/* Loading skeleton */}
      {loadingProjects ? (
        <View style={{ flex: 1 }}>
          {/* Page title row */}
          <View style={[styles.titleSection, { paddingTop: onClose ? 22 : 22 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={[styles.eyebrow, { color: theme.mintText }]}>YOUR WORKSPACES</Text>
                <Text style={[styles.title, { color: theme.ink }]}>Projects</Text>
              </View>
              <Pressable
                style={[styles.createBtn, { backgroundColor: theme.emerald, opacity: 0.5 }]}
                disabled
              >
                <Plus size={16} color="#FFF" strokeWidth={3} />
                <Text style={styles.createBtnText}>New</Text>
              </Pressable>
            </View>
          </View>
          <ProjectsSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          keyExtractor={(project) => project.id}
          contentContainerStyle={[styles.page, !hasProjects && styles.pageFull]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {/* Title row */}
              <Text style={[styles.eyebrow, { color: theme.mintText }]}>YOUR WORKSPACES</Text>
              <View style={styles.titleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.headerIcon, { backgroundColor: theme.mint }]}>
                    <Briefcase size={18} color={theme.emerald} strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={[styles.title, { color: theme.ink }]}>Projects</Text>
                    <Text style={[styles.projectCountText, { color: theme.muted }]}>
                      {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} · {sharedCount} agent
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setMode('create')}
                  style={[styles.createBtn, { backgroundColor: theme.emerald }]}
                >
                  <Plus size={16} color="#FFF" strokeWidth={3} />
                  <Text style={styles.createBtnText}>Create Project</Text>
                </Pressable>
              </View>

              {/* No Projects warning banner (amber) */}
              {!hasProjects && (
                <View style={[styles.warningBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Briefcase size={18} color="#D97706" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.warningTitle}>No Projects Found</Text>
                    <Text style={styles.warningBody}>
                      You need to create at least one project to access Live Chat, Templates, and Campaigns features.
                    </Text>
                    <Pressable
                      onPress={() => setMode('create')}
                      style={styles.warningButton}
                    >
                      <Text style={styles.warningButtonText}>Create Your First Project</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Search bar */}
              {hasProjects && (
                <View style={[styles.searchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Search size={18} color={theme.muted} />
                  <TextInput
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Search by project name or owner..."
                    placeholderTextColor={theme.muted}
                    style={[styles.searchInput, { color: theme.ink }]}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                  {searchTerm.length > 0 && (
                    <Pressable hitSlop={8} onPress={() => setSearchTerm('')}>
                      <Text style={{ color: theme.muted, fontSize: 16 }}>✕</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Stats summary row */}
              {hasProjects && (
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.statLabel, { color: theme.muted }]}>Total</Text>
                    <Text style={[styles.statValue, { color: theme.ink }]}>{filteredProjects.length}</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.statLabel, { color: theme.muted }]}>Admin</Text>
                    <Text style={[styles.statValue, { color: theme.emerald }]}>{ownedCount}</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.statLabel, { color: theme.muted }]}>Agent</Text>
                    <Text style={[styles.statValue, { color: theme.ink }]}>{sharedCount}</Text>
                  </View>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            hasProjects ? (
              // Search returned no results
              <View style={styles.emptySearchContainer}>
                <Text style={[styles.emptyTitle, { color: theme.ink }]}>No results found</Text>
                <Text style={[styles.emptyCopy, { color: theme.muted }]}>
                  No projects match "{searchTerm}"
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const profileImg =
              (item as any).profile_image ||
              (item as any).profile_picture ||
              (item as any).profile_picture_url ||
              (item as any).logo ||
              (item as any).image;
            const isOwned = item.owned === true;
            const isActive = item.id === currentProjectId;
            const ownerName = (item as any).ownerName || (item as any).owner_name;
            // Theme-aware active card colors
            const activeBg = theme.isDark ? '#0D2B22' : '#EEF2FF';
            const activeBorder = theme.isDark ? theme.emerald : '#818CF8';
            const activeText = theme.isDark ? theme.emerald : '#4338CA';
            const activeBadgeBg = theme.isDark ? '#103B35' : '#EEF2FF';
            const adminBadgeBg = theme.isDark ? '#103B35' : '#EEF2FF';
            const adminBadgeText = theme.isDark ? theme.emerald : '#4338CA';
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (isOwned) {
                    void onSelect(item.id);
                  } else {
                    void onSelect(item.id);
                  }
                }}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: isActive ? activeBg : theme.surface,
                    borderColor: isActive ? activeBorder : theme.border,
                    shadowColor: theme.shadow,
                  },
                  pressed && { backgroundColor: theme.cardHover },
                ]}
              >
                <ProjectAvatar
                  name={item.name}
                  image={profileImg}
                  size={45}
                  borderRadius={14}
                />
                <View style={styles.cardText}>
                  {/* Name + role badge row */}
                  <View style={styles.cardNameRow}>
                    <Text numberOfLines={1} style={[styles.name, { color: isActive ? activeText : theme.ink, flex: 1 }]}>
                      {item.name}
                    </Text>
                    {isOwned ? (
                      <View style={[styles.roleBadge, { backgroundColor: adminBadgeBg }]}>
                        <Shield size={10} color={adminBadgeText} />
                        <Text style={[styles.roleBadgeText, { color: adminBadgeText }]}>Admin</Text>
                      </View>
                    ) : (
                      <View style={[styles.roleBadge, { backgroundColor: theme.canvas, borderWidth: 1, borderColor: theme.border }]}>
                        <UserCheck size={10} color={theme.muted} />
                        <Text style={[styles.roleBadgeText, { color: theme.muted }]}>Agent</Text>
                      </View>
                    )}
                  </View>

                  {/* Owner name */}
                  {ownerName && (
                    <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
                      {ownerName}
                    </Text>
                  )}

                  {/* Bottom row: Current + View Details */}
                  <View style={styles.cardFooter}>
                    {isActive && (
                      <View style={[styles.currentBadge, { backgroundColor: activeBadgeBg }]}>
                        <Text style={[styles.currentBadgeText, { color: activeText }]}>Current</Text>
                      </View>
                    )}
                    {isOwned && (
                      <Pressable
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setManageProjectId(item.id);
                          setMode('manage');
                        }}
                        style={styles.viewDetailsBtn}
                      >
                        <Eye size={12} color={theme.emerald} />
                        <Text style={[styles.viewDetailsBtnText, { color: theme.emerald }]}>View Details</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* QR Code button */}
                <Pressable
                  hitSlop={8}
                  style={[styles.actionBtn, { backgroundColor: theme.mint }]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setQrProject(item);
                  }}
                  accessibilityLabel={`View QR Code for ${item.name}`}
                >
                  <QrCode size={18} color={theme.emerald} strokeWidth={2.2} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      {/* Project QR Code Modal */}
      {qrProject && (
        <ProjectQRModal
          visible={!!qrProject}
          onClose={() => setQrProject(null)}
          session={session}
          projectId={qrProject.id}
          projectName={qrProject.name}
          projectImage={
            (qrProject as any).profile_image ||
            (qrProject as any).profile_picture ||
            (qrProject as any).logo ||
            (qrProject as any).image
          }
        />
      )}
    </KeyboardAvoidView>
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
  titleSection: {
    paddingHorizontal: 22,
    paddingBottom: 0,
  },
  page: { padding: 22, paddingBottom: 32 },
  pageFull: { flexGrow: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  projectCountText: { fontSize: 12, marginTop: 2 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 5,
  },
  createBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Warning banner (no projects)
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  warningBody: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
  },
  warningButton: {
    marginTop: 10,
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  warningButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Search bar
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },

  // Project card
  card: {
    minHeight: 80,
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
  skeletonAvatar: { width: 45, height: 45, borderRadius: 14 },
  cardText: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 3 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },

  // Role badge
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },

  // Current badge
  currentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  currentBadgeText: { fontSize: 10, fontWeight: '700' },

  // View Details
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsBtnText: { fontSize: 12, fontWeight: '600' },

  // Action button (QR)
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty search state
  emptySearchContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyCopy: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});