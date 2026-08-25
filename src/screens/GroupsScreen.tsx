import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, Plus, Search, Users, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ApiSession, post } from '../api/client';
import { getContactGroups } from '../api/workspace';
import { FadeInView, ScalePressable } from '../components/animations';
import { LoadState } from '../components/LoadState';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import { useTheme } from '../theme/theme';

type GroupsProps = {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
  onOpen: (group: any) => void;
};

const PAGE_SIZE = 25;

export function GroupsScreen({ projectId, session, onBack, onOpen }: GroupsProps) {
  const theme = useTheme();

  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  // Search state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Create modal state
  const [name, setName] = useState('');
  const [remark, setRemark] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load groups (first page or subsequent page)
  const loadGroups = useCallback(
    async (pageToLoad: number, searchQuery: string, isRefresh = false) => {
      if (!projectId || !session?.token) return;
      if (pageToLoad === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError('');

      try {
        const res = await getContactGroups(
          session,
          projectId,
          pageToLoad,
          PAGE_SIZE,
          searchQuery,
        );

        if (res?.error && typeof res.error === 'string') {
          throw new Error(res.error);
        }

        const rawList = res?.data || res?.list || [];
        const fetchedList = Array.isArray(rawList) ? rawList : [];

        if (pageToLoad === 1 || isRefresh) {
          setGroups(fetchedList);
        } else {
          setGroups((prev) => {
            const existingIds = new Set(
              prev.map((g) => String(g.group_id || g.id)),
            );
            const newItems = fetchedList.filter(
              (g: any) => !existingIds.has(String(g.group_id || g.id)),
            );
            return [...prev, ...newItems];
          });
        }

        // Determine if there are more pages
        const meta = res?.meta;
        const total = meta?.total !== undefined ? Number(meta.total) : undefined;
        if (total !== undefined) {
          setHasMore(pageToLoad * PAGE_SIZE < total);
        } else {
          setHasMore(fetchedList.length === PAGE_SIZE);
        }
        setPage(pageToLoad);
      } catch (err: any) {
        if (pageToLoad === 1) {
          setGroups([]);
        }
        setError(err?.message || 'Could not load groups');
        Toast.show({
          type: 'error',
          text1: 'Could not load groups',
          text2: err?.message,
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId, session],
  );

  // Trigger initial fetch or re-fetch on search change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadGroups(1, debouncedSearch);
  }, [loadGroups, debouncedSearch]);

  const handleRefresh = () => {
    loadGroups(1, debouncedSearch, true);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore && groups.length >= PAGE_SIZE) {
      loadGroups(page + 1, debouncedSearch);
    }
  };

  // Client-side fallback search filter in case server search returns unfiltered results
  const displayGroups = useMemo(() => {
    if (!debouncedSearch.trim()) return groups;
    const q = debouncedSearch.toLowerCase().trim();
    return groups.filter(
      (g) =>
        (g.name && g.name.toLowerCase().includes(q)) ||
        (g.remark && g.remark.toLowerCase().includes(q)),
    );
  }, [groups, debouncedSearch]);

  const create = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Toast.show({ type: 'error', text1: 'Group name is required' });
      return;
    }
    setCreating(true);
    try {
      const res = await post<any>(
        '/contact/create-group',
        {
          project_id: projectId,
          name: trimmedName,
          remark: remark.trim(),
        },
        session,
      );
      if (res?.error) {
        throw new Error(
          typeof res.error === 'string' ? res.error : 'Could not create group',
        );
      }
      setName('');
      setRemark('');
      setShowCreate(false);
      loadGroups(1, debouncedSearch, true);
      Toast.show({ type: 'success', text1: 'Group created' });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not create group',
        text2: e?.message,
      });
    } finally {
      setCreating(false);
    }
  };

  // CREATE GROUP FULL-SCREEN
  if (showCreate) {
    return (
      <KeyboardAvoidView
        style={[styles.container, { backgroundColor: theme.canvas }]}
      >
        <FadeInView direction="right" distance={16} duration={260} style={{ flex: 1 }}>
          <View
            style={[
              styles.header,
              { backgroundColor: theme.header, borderBottomColor: theme.border },
            ]}
          >
            <Pressable
              onPress={() => setShowCreate(false)}
              style={styles.back}
              hitSlop={8}
            >
              <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
            </Pressable>
            <View>
              <Text style={[styles.title, { color: theme.ink }]}>Create Group</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                Add a new contact group
              </Text>
            </View>
          </View>

          <View style={styles.createScreen}>
            <Text style={[styles.createLabel, { color: theme.ink }]}>
              Group name *
            </Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Enter group name"
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                {
                  color: theme.ink,
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
              ]}
            />
            <Text style={[styles.createLabel, { color: theme.ink }]}>
              Remark (optional)
            </Text>
            <TextInput
              value={remark}
              onChangeText={setRemark}
              placeholder="Enter remark"
              placeholderTextColor={theme.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[
                styles.remarkInput,
                {
                  color: theme.ink,
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
              ]}
            />
            <ScalePressable
              onPress={create}
              disabled={creating}
              style={[
                styles.createButton,
                { backgroundColor: theme.emerald },
              ]}
            >
              {creating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.createButtonText}>Create group</Text>
              )}
            </ScalePressable>
          </View>
        </FadeInView>
      </KeyboardAvoidView>
    );
  }

  const renderGroup = ({ item, index }: { item: any; index: number }) => (
    <FadeInView delay={Math.min(index * 35, 250)} distance={12} duration={280}>
      <ScalePressable
        onPress={() => onOpen(item)}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: theme.mint }]}>
          <Users size={18} color={theme.emerald} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.groupName, { color: theme.ink }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.count, { color: theme.muted }]} numberOfLines={1}>
            {item.contact_count || item.count || 0} contact
            {(item.contact_count || item.count || 0) === 1 ? '' : 's'}
            {item.remark ? ` · ${item.remark}` : ''}
          </Text>
        </View>
        <Text style={{ color: theme.emerald, fontSize: 22 }}>›</Text>
      </ScalePressable>
    </FadeInView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.header, borderBottomColor: theme.border },
        ]}
      >
        <Pressable onPress={onBack} style={styles.back} hitSlop={8}>
          <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.ink }]}>Contact Groups</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Tap a group to view its contacts
          </Text>
        </View>
      </View>

      {/* Top Search Bar */}
      <View
        style={[
          styles.searchRow,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <Search size={17} color={theme.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search groups by name..."
          placeholderTextColor={theme.muted}
          style={[styles.searchInput, { color: theme.ink }]}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <X size={16} color={theme.muted} />
          </Pressable>
        )}
      </View>

      {/* Groups List with Pull-to-refresh & Infinite Scroll Pagination */}
      <FlatList
        data={displayGroups}
        renderItem={renderGroup}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={theme.emerald}
          />
        }
        contentContainerStyle={
          displayGroups.length ? styles.listContent : styles.emptyListContent
        }
        keyExtractor={(item, index) =>
          String(item.group_id || item.id || index) + '-' + index
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <LoadState
            loading={loading}
            error={error}
            empty={!displayGroups.length}
            emptyTitle="No groups found"
            emptyCopy={
              search
                ? 'No groups match your search query.'
                : 'No contact groups found in this project.'
            }
            onRetry={handleRefresh}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.emerald} />
              <Text style={[styles.footerLoaderText, { color: theme.muted }]}>
                Loading more groups...
              </Text>
            </View>
          ) : null
        }
      />

      {/* Floating Action Button to Create Group */}
      <ScalePressable
        onPress={() => setShowCreate(true)}
        accessibilityRole="button"
        accessibilityLabel="Create group"
        style={[styles.fab, { backgroundColor: theme.emerald }]}
      >
        <Plus size={24} color="#FFF" strokeWidth={2.5} />
      </ScalePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  back: { padding: 4, marginRight: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 13 },
  listContent: { padding: 14, gap: 10, paddingBottom: 100 },
  emptyListContent: { flexGrow: 1, padding: 14 },
  createScreen: { padding: 18, gap: 10 },
  createLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  remarkInput: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingTop: 12,
    fontSize: 14,
  },
  createButton: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  createButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 12, marginTop: 3 },
  footerLoader: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoaderText: { fontSize: 12 },
});
