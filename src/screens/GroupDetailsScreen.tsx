import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {ApiSession} from '../api/client';
import {getGroupContacts, removeContactFromGroup} from '../api/workspace';
import {FadeInView, ScalePressable} from '../components/animations';
import {useTheme} from '../theme/theme';

type GroupDetailsProps = {
  projectId: string;
  session: ApiSession;
  group: any;
  onBack: () => void;
  onOpenChat?: (contactNumber: string, contactName: string) => void;
};

export function GroupDetailsScreen({
  projectId,
  session,
  group,
  onBack,
  onOpenChat,
}: GroupDetailsProps) {
  const theme = useTheme();
  const groupId = String(group.group_id || group.id);
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | number | null>(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const contactKey = (item: any) =>
    String(item.unique_id || item.contact_id || item.id || '');

  const contactIdOf = (item: any) =>
    String(item.contact_id || item.id || item.unique_id || '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getGroupContacts(
        session,
        projectId,
        groupId,
        1,
        100,
        search,
      );
      const list = response?.data || response?.list || [];
      const listArray = Array.isArray(list) ? list : [];
      setContacts(listArray);
      setTotal(response?.meta?.total_records ?? response?.count ?? listArray.length);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load group contacts',
        text2: error?.message,
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, projectId, search, session.token, session.username]);

  useEffect(() => {
    load();
  }, [load]);

  // Toggle selection for a single contact
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Select all or deselect all
  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length && contacts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map((c) => contactIdOf(c)).filter(Boolean));
    }
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  // Single remove
  const removeSingle = async (contact: any) => {
    const id = contactIdOf(contact);
    setRemovingId(id);
    try {
      const response = await removeContactFromGroup(
        session,
        projectId,
        groupId,
        contact,
      );
      if (response?.error) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to remove contact',
        );
      }
      Toast.show({
        type: 'success',
        text1: 'Contact removed',
        text2: 'Removed from group successfully',
      });
      load();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not remove contact',
        text2: error?.message,
      });
    } finally {
      setRemovingId(null);
    }
  };

  // Bulk remove
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    const performDelete = async () => {
      setBulkDeleting(true);
      try {
        const response = await removeContactFromGroup(
          session,
          projectId,
          groupId,
          selectedIds,
        );
        if (response?.error) {
          throw new Error(
            typeof response.error === 'string'
              ? response.error
              : 'Failed to remove contacts',
          );
        }
        Toast.show({
          type: 'success',
          text1: 'Contacts removed',
          text2: `Successfully removed ${selectedIds.length} contact(s)`,
        });
        exitSelectionMode();
        load();
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'Bulk remove failed',
          text2: error?.message,
        });
      } finally {
        setBulkDeleting(false);
      }
    };

    Alert.alert(
      'Remove Contacts',
      `Are you sure you want to remove ${selectedIds.length} contact(s) from this group?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: performDelete,
        },
      ],
    );
  };

  const renderContact = ({item, index}: {item: any; index: number}) => {
    const id = contactIdOf(item);
    const isSelected = selectedIds.includes(id);
    const num = item.number || item.mobile || '';
    const name = item.name || num || 'Unnamed contact';

    return (
      <FadeInView delay={Math.min(index * 25, 200)} distance={10} duration={240}>
        <Pressable
          onPress={() => {
            if (selectionMode) {
              toggleSelect(id);
            } else if (num && onOpenChat) {
              onOpenChat(num, name);
            }
          }}
          onLongPress={() => {
            if (!selectionMode) {
              setSelectionMode(true);
              setSelectedIds([id]);
            }
          }}
          style={[
            styles.card,
            {
              backgroundColor: isSelected ? theme.mint : theme.surface,
              borderColor: isSelected ? theme.emerald : theme.border,
            },
          ]}
        >
          {selectionMode ? (
            <Pressable
              onPress={() => toggleSelect(id)}
              style={[
                styles.checkbox,
                {
                  backgroundColor: isSelected ? theme.emerald : 'transparent',
                  borderColor: isSelected ? theme.emerald : theme.muted,
                },
              ]}
            >
              {isSelected ? <Check size={14} color="#FFF" /> : null}
            </Pressable>
          ) : (
            <View style={[styles.avatar, {backgroundColor: theme.mint}]}>
              <Text style={{color: theme.mintText, fontWeight: '900'}}>
                {(name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={{flex: 1}}>
            <Text style={[styles.name, {color: theme.ink}]}>{name}</Text>
            <Text style={[styles.meta, {color: theme.muted}]}>{num || '-'}</Text>
            {item.email ? (
              <Text style={[styles.meta, {color: theme.muted}]}>{item.email}</Text>
            ) : null}
          </View>

          {!selectionMode && (
            <Pressable
              onPress={() => removeSingle(item)}
              disabled={removingId === id}
              style={styles.delete}
            >
              {removingId === id ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Trash2 size={17} color="#DC2626" />
              )}
            </Pressable>
          )}
        </Pressable>
      </FadeInView>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.canvas}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {backgroundColor: theme.header, borderBottomColor: theme.border},
        ]}
      >
        <Pressable
          onPress={selectionMode ? exitSelectionMode : onBack}
          style={styles.back}
        >
          {selectionMode ? (
            <X size={21} color={theme.ink} />
          ) : (
            <ArrowLeft size={21} color={theme.ink} />
          )}
        </Pressable>

        <View style={{flex: 1}}>
          <Text style={[styles.title, {color: theme.ink}]}>
            {selectionMode
              ? `${selectedIds.length} Selected`
              : group.name || 'Group details'}
          </Text>
          <Text style={[styles.subtitle, {color: theme.muted}]}>
            {total} contact(s)
          </Text>
        </View>

        {!selectionMode ? (
          <ScalePressable
            onPress={() => setSelectionMode(true)}
            style={[styles.selectBtn, {borderColor: theme.border}]}
          >
            <CheckSquare size={16} color={theme.emerald} />
            <Text style={[styles.selectBtnText, {color: theme.emerald}]}>
              Select
            </Text>
          </ScalePressable>
        ) : (
          <ScalePressable
            onPress={toggleSelectAll}
            style={[styles.selectBtn, {borderColor: theme.border}]}
          >
            <Text style={[styles.selectBtnText, {color: theme.emerald}]}>
              {selectedIds.length === contacts.length && contacts.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </Text>
          </ScalePressable>
        )}
      </View>

      {/* Bulk Action Bar when items are selected */}
      {selectionMode && (
        <View
          style={[
            styles.bulkBar,
            {backgroundColor: theme.surface, borderBottomColor: theme.border},
          ]}
        >
          <Text style={[styles.bulkText, {color: theme.ink}]}>
            {selectedIds.length} selected for deletion
          </Text>
          <ScalePressable
            onPress={handleBulkDelete}
            disabled={bulkDeleting || selectedIds.length === 0}
            style={[
              styles.bulkDeleteBtn,
              {opacity: selectedIds.length === 0 ? 0.5 : 1},
            ]}
          >
            {bulkDeleting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Trash2 size={16} color="#FFF" />
                <Text style={styles.bulkDeleteBtnText}>
                  Delete ({selectedIds.length})
                </Text>
              </>
            )}
          </ScalePressable>
        </View>
      )}

      {/* Search Box */}
      <View
        style={[
          styles.search,
          {backgroundColor: theme.surface, borderColor: theme.border},
        ]}
      >
        <Search size={17} color={theme.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search group contacts"
          placeholderTextColor={theme.muted}
          style={[styles.searchInput, {color: theme.ink}]}
        />
      </View>

      {/* Contact List */}
      <FlatList
        data={contacts}
        keyExtractor={contactKey}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        contentContainerStyle={{padding: 14, gap: 10}}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, {color: theme.muted}]}>
              No contacts in this group.
            </Text>
          ) : null
        }
        renderItem={renderContact}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 8,
  },
  back: {padding: 4, marginRight: 4},
  title: {fontSize: 18, fontWeight: '800'},
  subtitle: {fontSize: 11, marginTop: 2},
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectBtnText: {fontSize: 12, fontWeight: '700'},
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bulkText: {fontSize: 13, fontWeight: '600'},
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bulkDeleteBtnText: {color: '#FFF', fontSize: 13, fontWeight: '700'},
  search: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    height: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {flex: 1, fontSize: 14},
  card: {
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {fontSize: 14, fontWeight: '800'},
  meta: {fontSize: 12, marginTop: 2},
  delete: {padding: 10},
  empty: {textAlign: 'center', padding: 40},
});
