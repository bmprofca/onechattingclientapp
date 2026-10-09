import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  BackHandler,
  FlatList,
  Modal,
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  PanResponder,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Contacts from 'react-native-contacts';
import { BlurView } from '@react-native-community/blur';
import {
  ArrowLeft,
  Building2,
  Check,
  Edit2,
  FileText,
  Globe,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Smartphone,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react-native';
import Toast from '../ui/toast';
import { ApiSession } from '../api/client';
import {
  addContactsToGroups,
  getContactAssignedGroups,
  getContactDetails,
  getContactGroups,
  getContactList,
  getFavoriteContactList,
  removeContactFromGroup,
  createContact,
  deleteContacts,
  setContactFavorite,
  updateContact,
} from '../api/workspace';
import { FadeInView, ScalePressable } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import { LoadState } from '../components/LoadState';
import { useKeyboardContext } from '../contexts/KeyboardContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

export type Group = {
  id: string;
  group_id?: string;
  name: string;
  contact_count?: number;
  remark?: string;
};

export type ContactsProps = {
  projectId: string;
  session: ApiSession;
  onBack: () => void;
  onOpenChat?: (contactNumber: string, contactName: string) => void;
  onOpenGroupDetails?: (group: Group) => void;
};

export function ContactsScreen({
  projectId,
  session,
  onBack,
  onOpenChat,
  onOpenGroupDetails,
}: ContactsProps) {
  const theme = useTheme();
  const {isKeyboardVisible} = useKeyboardContext();
  const insets = useSafeAreaInsets();

  // Contact list state
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [favoriteNumbers, setFavoriteNumbers] = useState<Set<string>>(new Set());
  const [favoriteLoadingNumber, setFavoriteLoadingNumber] = useState<string | null>(null);
  const [actionMenuContact, setActionMenuContact] = useState<any>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFirmName, setNewFirmName] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [deviceContactsVisible, setDeviceContactsVisible] = useState(false);
  const [deviceContactsLoading, setDeviceContactsLoading] = useState(false);
  const [deviceContactsSearch, setDeviceContactsSearch] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<
    Array<{ id: string; name: string; number: string; email?: string }>
  >([]);

  // Bulk selection state (for main contacts list)
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);

  // Edit contact page state (includes all API attributes: name, number, email, firm_name, website, remark)
  const [editing, setEditing] = useState<any>(null);
  const [editTab, setEditTab] = useState<'details' | 'groups'>('details');
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFirmName, setEditFirmName] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [_editGroups, setEditGroups] = useState<string[]>([]);
  const [assignedContactGroups, setAssignedContactGroups] = useState<any[]>([]);
  const [loadingContactGroups, setLoadingContactGroups] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Choose groups page state
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [groupPickerMode, setGroupPickerMode] = useState<'bulk' | 'edit'>('bulk');
  const [pickerSelectedGroups, setPickerSelectedGroups] = useState<string[]>([]);
  const [groupSelectionMode, setGroupSelectionMode] = useState(false);
  const [groupPickerSearch, setGroupPickerSearch] = useState('');

  const closeEditModal = () => setEditing(null);
  const editHeaderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 12 && gesture.dy > Math.abs(gesture.dx) * 1.2,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 60) setEditing(null);
        },
      }),
    [],
  );

  // Hardware Back Handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (actionMenuContact) {
        setActionMenuContact(null);
        return true;
      }
      if (deviceContactsVisible) {
        setDeviceContactsVisible(false);
        return true;
      }
      if (createModalVisible) {
        setCreateModalVisible(false);
        return true;
      }
      if (groupPickerVisible) {
        if (groupSelectionMode) {
          setGroupSelectionMode(false);
          setPickerSelectedGroups([]);
          return true;
        }
        setGroupPickerVisible(false);
        return true;
      }
      if (editing) {
        closeEditModal();
        return true;
      }
      if (selectionMode) {
        setSelectionMode(false);
        setSelected([]);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [
    onBack,
    actionMenuContact,
    deviceContactsVisible,
    createModalVisible,
    groupPickerVisible,
    groupSelectionMode,
    editing,
    selectionMode,
  ]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const CONTACTS_PAGE_SIZE = 30;

  // Load contacts and groups
  const loadContacts = useCallback(
    async (pageToLoad: number, searchQuery: string, isRefresh = false) => {
      if (!projectId || !session?.token) return;
      if (pageToLoad === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError('');

      try {
        const contactRequest = showFavorites
          ? getFavoriteContactList(session, projectId, pageToLoad, searchQuery)
          : getContactList(session, projectId, pageToLoad, CONTACTS_PAGE_SIZE, searchQuery);
        const promises: [Promise<any>, Promise<any>?] = [contactRequest];
        if (pageToLoad === 1) {
          promises.push(getContactGroups(session, projectId, 1, 100));
        }

        const [contactResponse, groupResponse] = await Promise.all(promises);

        const rawList = contactResponse?.data || contactResponse?.list || [];
        const fetchedList = Array.isArray(rawList) ? rawList : [];

        if (showFavorites) {
          setFavoriteNumbers((previous) => {
            const next = pageToLoad === 1 ? new Set<string>() : new Set(previous);
            fetchedList.forEach((contact: any) => {
              const number = String(contact.number || contact.contact_number || '');
              if (number) next.add(number);
            });
            return next;
          });
        }

        if (pageToLoad === 1 || isRefresh) {
          setContacts(fetchedList);
        } else {
          setContacts((prev) => {
            const existingIds = new Set(
              prev.map((c) => String(c.contact_id || c.id || c.number || '')),
            );
            const newItems = fetchedList.filter(
              (c: any) => !existingIds.has(String(c.contact_id || c.id || c.number || '')),
            );
            return [...prev, ...newItems];
          });
        }

        if (groupResponse) {
          const groupList = groupResponse?.data || groupResponse?.list || [];
          setGroups(
            (Array.isArray(groupList) ? groupList : []).map((g: any) => ({
              id: String(g.group_id || g.id),
              name: g.name || 'Untitled Group',
              contact_count: g.contact_count || g.count || 0,
              remark: g.remark || '',
            })),
          );
        }

        const meta = contactResponse?.meta;
        const total = meta?.total !== undefined ? Number(meta.total) : undefined;
        if (showFavorites && typeof contactResponse?.is_last_page === 'boolean') {
          setHasMore(!contactResponse.is_last_page);
        } else if (total !== undefined) {
          setHasMore(pageToLoad * CONTACTS_PAGE_SIZE < total);
        } else {
          setHasMore(fetchedList.length === (showFavorites ? 20 : CONTACTS_PAGE_SIZE));
        }
        setPage(pageToLoad);
      } catch (err: any) {
        if (pageToLoad === 1) {
          setContacts([]);
        }
        setError(err?.message || 'Could not load contacts');
        Toast.show({
          type: 'error',
          text1: 'Could not load contacts',
          text2: err?.message,
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId, session, showFavorites],
  );

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadContacts(1, debouncedSearch);
  }, [loadContacts, debouncedSearch]);

  const load = useCallback(() => {
    return loadContacts(1, debouncedSearch, true);
  }, [loadContacts, debouncedSearch]);

  useEffect(() => {
    let isMounted = true;
    const loadFavorites = async () => {
      try {
        const numbers = new Set<string>();
        let pageToLoad = 1;
        let isLastPage = false;
        while (!isLastPage) {
          const response = await getFavoriteContactList(
            session,
            projectId,
            pageToLoad,
          );
          const rows = Array.isArray(response?.data) ? response.data : [];
          rows.forEach((contact: any) => {
            const number = String(contact.number || contact.contact_number || '');
            if (number) numbers.add(number);
          });
          isLastPage =
            response?.is_last_page === true ||
            (typeof response?.is_last_page !== 'boolean' && rows.length < 20);
          if (!rows.length) isLastPage = true;
          pageToLoad += 1;
        }
        if (isMounted) setFavoriteNumbers(numbers);
      } catch (err: any) {
        if (isMounted) {
          Toast.show({
            type: 'error',
            text1: 'Could not load favorites',
            text2: err?.message,
          });
        }
      }
    };

    if (projectId && session?.token) {
      loadFavorites();
    }
    return () => {
      isMounted = false;
    };
  }, [projectId, session]);

  const handleLoadMoreContacts = () => {
    if (!loading && !loadingMore && hasMore && contacts.length > 0) {
      loadContacts(page + 1, debouncedSearch);
    }
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewNumber('');
    setNewEmail('');
    setNewFirmName('');
    setNewWebsite('');
    setNewRemark('');
    setDeviceContactsSearch('');
  };

  const loadDeviceContacts = async () => {
    setDeviceContactsLoading(true);
    try {
      let hasPermission = true;
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts Permission',
            message: 'OneChat needs access to your device contacts to add them to this project.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      }

      if (!hasPermission) {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Please allow contacts permission to choose a phonebook contact.',
        });
        return;
      }

      const raw = await Contacts.getAllWithoutPhotos();
      const parsed: Array<{ id: string; name: string; number: string; email?: string }> = [];
      const seen = new Set<string>();
      raw.forEach((contact) => {
        const name =
          [contact.givenName, contact.middleName, contact.familyName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          contact.displayName ||
          'Unnamed Contact';
        contact.phoneNumbers?.forEach((phone) => {
          const number = String(phone.number || '').replace(/[^0-9+]/g, '');
          const digits = number.replace(/\D/g, '');
          const key = `${name}-${digits}`;
          if (digits.length >= 7 && !seen.has(key)) {
            seen.add(key);
            parsed.push({
              id: `${contact.recordID || ''}-${phone.label || ''}-${digits}`,
              name,
              number,
              email: contact.emailAddresses?.[0]?.email || '',
            });
          }
        });
      });
      parsed.sort((left, right) => left.name.localeCompare(right.name));
      setDeviceContacts(parsed);
      setDeviceContactsSearch('');
      setDeviceContactsVisible(true);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load contacts',
        text2: err?.message || 'Failed to read contacts from device.',
      });
    } finally {
      setDeviceContactsLoading(false);
    }
  };

  const filteredDeviceContacts = useMemo(() => {
    const query = deviceContactsSearch.trim().toLowerCase();
    if (!query) return deviceContacts;
    return deviceContacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.number.toLowerCase().includes(query),
    );
  }, [deviceContacts, deviceContactsSearch]);

  const handleCreateContact = async () => {
    const name = newName.trim();
    const number = newNumber.replace(/\D/g, '');
    if (!name || number.length < 7) {
      Toast.show({
        type: 'error',
        text1: 'Name and phone number are required',
        text2: 'Enter a contact name and a valid number with country code.',
      });
      return;
    }

    setCreatingContact(true);
    try {
      const response = await createContact(session, projectId, {
        name,
        number,
        email: newEmail.trim(),
        firm_name: newFirmName.trim(),
        website: newWebsite.trim(),
        remark: newRemark.trim(),
      });
      if (response?.error) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : response?.msg || 'Failed to create contact',
        );
      }

      Toast.show({
        type: 'success',
        text1: 'Contact created',
        text2: `${name} was added to this project.`,
      });
      setCreateModalVisible(false);
      resetCreateForm();
      await load();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not create contact',
        text2: err?.message || 'Please try again.',
      });
    } finally {
      setCreatingContact(false);
    }
  };

  const handleToggleFavorite = async (item: any) => {
    const number = String(item.number || item.mobile || '');
    if (!number || favoriteLoadingNumber) return;

    const isFavorite = favoriteNumbers.has(number);
    setFavoriteLoadingNumber(number);
    try {
      const response = await setContactFavorite(
        session,
        projectId,
        number,
        isFavorite ? 'delete' : 'add',
      );
      setFavoriteNumbers((previous) => {
        const next = new Set(previous);
        if (response?.is_favorite === true) {
          next.add(number);
        } else {
          next.delete(number);
        }
        return next;
      });
      if (showFavorites && response?.is_favorite !== true) {
        setContacts((previous) =>
          previous.filter(
            (contact) => String(contact.number || contact.mobile || '') !== number,
          ),
        );
      }
      Toast.show({
        type: 'success',
        text1: response?.is_favorite ? 'Added to favorites' : 'Removed from favorites',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not change favorite',
        text2: err?.message,
      });
    } finally {
      setFavoriteLoadingNumber(null);
    }
  };

  const confirmDeleteContact = (item: any) => {
    const number = String(item.number || item.mobile || '');
    const contactId = idOf(item);
    const contactName = String(item.name || number || 'this contact');
    Alert.alert(
      'Delete contact?',
      `Remove ${contactName} from this project?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteContacts(session, projectId, {
                contactIds: contactId ? [contactId] : [],
                numbers: number ? [number] : [],
              });
              if (response?.error) {
                throw new Error(
                  typeof response.error === 'string'
                    ? response.error
                    : 'Failed to delete contact',
                );
              }
              Toast.show({ type: 'success', text1: 'Contact deleted' });
              await load();
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Could not delete contact',
                text2: err?.message,
              });
            }
          },
        },
      ],
    );
  };

  const handleSelectDeviceContact = (contact: {
    name: string;
    number: string;
    email?: string;
  }) => {
    setNewName(contact.name);
    setNewNumber(contact.number.replace(/\D/g, ''));
    setNewEmail(contact.email || '');
    setDeviceContactsVisible(false);
  };

  const confirmDeleteSelected = () => {
    if (!selected.length) return;
    Alert.alert(
      'Delete selected contacts?',
      `Remove ${selected.length} selected contact(s) from this project?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBulkAssignLoading(true);
            try {
              const response = await deleteContacts(session, projectId, {
                contactIds: selected,
              });
              if (response?.error) {
                throw new Error(
                  typeof response.error === 'string'
                    ? response.error
                    : 'Failed to delete contacts',
                );
              }
              Toast.show({
                type: 'success',
                text1: 'Contacts deleted',
                text2: `${response?.deleted_count ?? selected.length} contact(s) removed.`,
              });
              setSelectionMode(false);
              setSelected([]);
              await load();
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Could not delete contacts',
                text2: err?.message,
              });
            } finally {
              setBulkAssignLoading(false);
            }
          },
        },
      ],
    );
  };

  const idOf = (item: any) => item?.contact_id || item?.id;

  // Toggle selection for a single contact in main list
  const toggle = (id: string | number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  };

  // Select all or clear all contacts
  const toggleSelectAll = () => {
    if (selected.length === contacts.length && contacts.length > 0) {
      setSelected([]);
    } else {
      setSelected(contacts.map(idOf).filter(Boolean));
    }
  };

  // Cancel multi-selection
  const cancelSelection = () => {
    setSelected([]);
    setSelectionMode(false);
  };

  // Open Edit Contact Page with all attributes and fresh assigned groups
  const openEdit = async (item: any) => {
    let contact = item;
    try {
      const detailsResponse = await getContactDetails(
        session,
        projectId,
        String(item.number || item.mobile || ''),
      );
      const details = detailsResponse?.contact || detailsResponse?.data?.contact;
      if (detailsResponse?.has_contact === true && details) {
        contact = {...item, ...details};
      } else {
        throw new Error('Contact details were not found.');
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not refresh contact details',
        text2: err?.message || 'Using the contact data already loaded.',
      });
    }

    setEditing(contact);
    setEditTab('details');
    setEditName(contact.name || '');
    setEditNumber(String(contact.number || contact.mobile || ''));
    setEditEmail(contact.email || '');
    setEditFirmName(contact.firm_name || contact.company || '');
    setEditWebsite(contact.website || '');
    setEditRemark(contact.remark || '');

    const initialGroups: any[] = [];
    const initialGroupIds: string[] = [];
    if (Array.isArray(contact.groups)) {
      contact.groups.forEach((g: any) => {
        const gid = String(g.group_id || g.id || g);
        if (gid) {
          initialGroupIds.push(gid);
          initialGroups.push(
            typeof g === 'object'
              ? { id: gid, group_id: gid, name: g.name || g.group_name || `Group ${gid}`, remark: g.remark }
              : { id: gid, group_id: gid, name: `Group ${gid}` },
          );
        }
      });
    } else if (contact.group_id) {
      const gid = String(contact.group_id);
      initialGroupIds.push(gid);
      initialGroups.push({ id: gid, group_id: gid, name: `Group ${gid}` });
    }
    setAssignedContactGroups(initialGroups);
    setEditGroups(initialGroupIds);

    // Fetch fresh assigned groups for this contact from server
    const contactId = idOf(contact);
    if (contactId) {
      setLoadingContactGroups(true);
      getContactAssignedGroups(session, projectId, contactId)
        .then((res: any) => {
          if (res?.data && Array.isArray(res.data)) {
            const list = res.data.map((g: any) => ({
              id: String(g.group_id || g.id),
              group_id: String(g.group_id || g.id),
              name: g.name || `Group ${g.group_id || g.id}`,
              remark: g.remark || '',
              unique_id: g.unique_id,
            }));
            setAssignedContactGroups(list);
            setEditGroups(list.map((g: any) => g.id));
          }
        })
        .catch((err) => {
          console.warn('Failed to load contact groups:', err);
        })
        .finally(() => {
          setLoadingContactGroups(false);
        });
    }
  };

  // Save edited profile details only (no extra group API calls)
  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    const finalNumber = editNumber.trim() || String(editing.number || editing.mobile || '').trim();
    if (!finalNumber) {
      Toast.show({ type: 'error', text1: 'Phone number is required' });
      return;
    }

    setSaving(true);
    const contactId = idOf(editing);

    try {
      const response = await updateContact(session, projectId, {
        contact_id: contactId,
        project_id: projectId,
        name: editName.trim(),
        number: finalNumber,
        email: editEmail.trim(),
        firm_name: editFirmName.trim(),
        website: editWebsite.trim(),
        remark: editRemark.trim(),
      });

      if (response?.error) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : response?.msg || 'Failed to update contact',
        );
      }

      Toast.show({
        type: 'success',
        text1: 'Profile Details Saved',
        text2: 'Contact details updated successfully',
      });

      setEditing(null);
      load();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not update contact',
        text2: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Remove group directly from contact without calling updateContact
  const handleRemoveGroupFromContact = async (groupItem: any) => {
    if (!editing) return;
    const contactId = idOf(editing);
    const gid = String(groupItem.group_id || groupItem.id);
    const gName = groupItem.name || 'Group';

    setRemovingGroupId(gid);
    try {
      const res = await removeContactFromGroup(session, projectId, gid, contactId);
      if (res?.error) {
        throw new Error(
          typeof res.error === 'string' ? res.error : 'Failed to remove from group',
        );
      }

      setAssignedContactGroups((prev) =>
        prev.filter((g) => String(g.group_id || g.id) !== gid),
      );
      setEditGroups((prev) => prev.filter((id) => id !== gid));

      Toast.show({
        type: 'success',
        text1: 'Group Removed',
        text2: `Removed contact from ${gName}`,
      });

      load();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not remove group',
        text2: err?.message,
      });
    } finally {
      setRemovingGroupId(null);
    }
  };

  // Open Choose Groups Page for bulk selection
  const openBulkGroupPicker = () => {
    if (!selected.length) return;
    setGroupPickerMode('bulk');
    setPickerSelectedGroups([]);
    setGroupSelectionMode(false);
    setGroupPickerSearch('');
    setGroupPickerVisible(true);
  };

  // Open Choose Groups Page from edit contact page (only unassigned groups)
  const openEditGroupPicker = () => {
    setGroupPickerMode('edit');
    setPickerSelectedGroups([]);
    setGroupSelectionMode(false);
    setGroupPickerSearch('');
    setGroupPickerVisible(true);
  };

  // Helper to execute assignment of contacts to selected groups in a single request
  const assignContactsToGroupList = async (targetGroupIds: string[]) => {
    if (!targetGroupIds.length) {
      Toast.show({
        type: 'error',
        text1: 'No groups selected',
        text2: 'Please select at least one group.',
      });
      return;
    }

    setBulkAssignLoading(true);
    try {
      const res = await addContactsToGroups(
        session,
        projectId,
        targetGroupIds,
        selected,
      );

      if (res?.error && typeof res.error === 'string') {
        throw new Error(res.error);
      }

      Toast.show({
        type: 'success',
        text1: 'Group Assignment',
        text2: `Assigned ${selected.length} contact(s) to ${targetGroupIds.length} group(s)`,
      });

      setSelected([]);
      setSelectionMode(false);
      setGroupPickerVisible(false);
      setGroupSelectionMode(false);

      // If exactly one group was targeted and we have a navigation handler,
      // navigate directly to that group's details page.
      if (targetGroupIds.length === 1 && onOpenGroupDetails) {
        const targetGroup = groups.find(
          (g) => g.id === targetGroupIds[0],
        );
        if (targetGroup) {
          onOpenGroupDetails(targetGroup);
          return;
        }
      }

      load();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Assignment failed',
        text2: err?.message,
      });
    } finally {
      setBulkAssignLoading(false);
    }
  };

  // Toggle group selection inside picker when in bulk mode
  const togglePickerGroup = (groupId: string) => {
    setPickerSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  // Handle tap on a group card in Choose Groups page
  const handleGroupCardPress = async (group: Group) => {
    // If bulk checkboxes mode is ON, toggle the checkbox
    if (groupSelectionMode) {
      togglePickerGroup(group.id);
      return;
    }

    // In Edit Contact mode: single tap on an unassigned group immediately assigns it to the contact
    if (groupPickerMode === 'edit') {
      if (!editing) return;
      const contactId = idOf(editing);
      setBulkAssignLoading(true);
      try {
        const res = await addContactsToGroups(
          session,
          projectId,
          [group.id],
          [contactId],
        );
        if (res?.error && typeof res.error === 'string') {
          throw new Error(res.error);
        }

        const newGroupObj = {
          id: group.id,
          group_id: group.id,
          name: group.name,
          remark: group.remark,
          contact_count: (group.contact_count || 0) + 1,
        };
        setAssignedContactGroups((prev) => [...prev, newGroupObj]);
        setEditGroups((prev) => [...prev, group.id]);
        setGroupPickerVisible(false);

        Toast.show({
          type: 'success',
          text1: 'Group Added',
          text2: `Added contact to ${group.name}`,
        });

        load();
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: 'Could not assign group',
          text2: err?.message,
        });
      } finally {
        setBulkAssignLoading(false);
      }
    } else {
      // Bulk contacts mode: single group click assigns contacts directly to this group
      assignContactsToGroupList([group.id]);
    }
  };

  // Handle long press on a group card to activate bulk selection checkboxes
  const handleGroupCardLongPress = (group: Group) => {
    setGroupSelectionMode(true);
    setPickerSelectedGroups([group.id]);
  };

  // Confirm multiple groups when bulk selection mode is active
  const handleConfirmGroupPicker = async () => {
    if (groupPickerMode === 'edit') {
      if (!editing || !pickerSelectedGroups.length) return;
      const contactId = idOf(editing);
      setBulkAssignLoading(true);
      try {
        const res = await addContactsToGroups(
          session,
          projectId,
          pickerSelectedGroups,
          [contactId],
        );
        if (res?.error && typeof res.error === 'string') {
          throw new Error(res.error);
        }

        const newlyAdded = groups
          .filter((g) => pickerSelectedGroups.includes(g.id))
          .map((g) => ({
            id: g.id,
            group_id: g.id,
            name: g.name,
            remark: g.remark,
            contact_count: (g.contact_count || 0) + 1,
          }));

        setAssignedContactGroups((prev) => [...prev, ...newlyAdded]);
        setEditGroups((prev) => [...prev, ...pickerSelectedGroups]);
        setGroupPickerVisible(false);
        setGroupSelectionMode(false);
        setPickerSelectedGroups([]);

        Toast.show({
          type: 'success',
          text1: 'Groups Added',
          text2: `Added contact to ${pickerSelectedGroups.length} group(s)`,
        });

        load();
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: 'Assignment failed',
          text2: err?.message,
        });
      } finally {
        setBulkAssignLoading(false);
      }
      return;
    }

    await assignContactsToGroupList(pickerSelectedGroups);
  };

  // Filter groups for picker
  const filteredGroups = useMemo(() => {
    let sourceGroups = groups;

    // When in Edit Contact mode: exclude groups that are already assigned to this contact
    if (groupPickerMode === 'edit') {
      const assignedIds = new Set(
        assignedContactGroups.map((g) => String(g.group_id || g.id)),
      );
      sourceGroups = groups.filter(
        (g) => !assignedIds.has(String(g.id)),
      );
    }

    if (!groupPickerSearch.trim()) return sourceGroups;
    const q = groupPickerSearch.toLowerCase().trim();
    return sourceGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.remark && g.remark.toLowerCase().includes(q)),
    );
  }, [groups, groupPickerMode, assignedContactGroups, groupPickerSearch]);

  // =========================================================================
  // PAGE 1: CHOOSE GROUPS SEPARATE PAGE
  // =========================================================================
  if (groupPickerVisible) {
    return (
      <KeyboardAvoidView
        style={[styles.container, { backgroundColor: theme.canvas }]}
      >
        <FadeInView direction="right" distance={12} duration={250} style={{ flex: 1 }}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: theme.header, borderBottomColor: theme.border },
            ]}
          >
            <ScalePressable
              onPress={() => {
                if (groupSelectionMode) {
                  setGroupSelectionMode(false);
                  setPickerSelectedGroups([]);
                } else {
                  setGroupPickerVisible(false);
                }
              }}
              hitSlop={8}
              style={styles.backBtn}
            >
              <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
            </ScalePressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.ink }]}>
                {groupPickerMode === 'bulk' ? 'Assign to Groups' : 'Add to Group'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                {groupSelectionMode
                  ? `${pickerSelectedGroups.length} group(s) selected`
                  : groupPickerMode === 'edit'
                  ? 'Tap an unassigned group to add contact'
                  : 'Tap to choose · Press & hold to select multiple'}
              </Text>
            </View>

            {/* Select All / Clear All Toggle when in bulk selection mode */}
            {groupSelectionMode && filteredGroups.length > 0 && (
              <Pressable
                onPress={() => {
                  if (pickerSelectedGroups.length === filteredGroups.length) {
                    setPickerSelectedGroups([]);
                  } else {
                    setPickerSelectedGroups(filteredGroups.map((g) => g.id));
                  }
                }}
                hitSlop={8}
                style={[styles.pickerAllBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.pickerAllBtnText, { color: theme.emerald }]}>
                  {pickerSelectedGroups.length === filteredGroups.length
                    ? 'Clear All'
                    : 'Select All'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Search Box */}
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Search size={18} color={theme.muted} />
            <TextInput
              value={groupPickerSearch}
              onChangeText={setGroupPickerSearch}
              placeholder={
                groupPickerMode === 'edit'
                  ? 'Search unassigned groups...'
                  : 'Search groups to assign...'
              }
              placeholderTextColor={theme.muted}
              style={[styles.searchInput, { color: theme.ink }]}
            />
            {groupPickerSearch ? (
              <Pressable
                onPress={() => setGroupPickerSearch('')}
                hitSlop={6}
              >
                <X size={16} color={theme.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Groups List */}
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.pickerListContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyGroupsWrap}>
                <Users size={36} color={theme.muted} />
                <Text
                  style={[styles.emptyGroupsTitle, { color: theme.ink }]}
                >
                  {groupPickerMode === 'edit'
                    ? 'No Available Groups'
                    : 'No Groups Found'}
                </Text>
                <Text
                  style={[styles.emptyGroupsSubtitle, { color: theme.muted }]}
                >
                  {groupPickerMode === 'edit'
                    ? 'All available groups are already assigned to this contact.'
                    : 'No matching groups found in this project.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isGroupChecked = pickerSelectedGroups.includes(item.id);

              return (
                <ScalePressable
                  onPress={() => handleGroupCardPress(item)}
                  onLongPress={() => handleGroupCardLongPress(item)}
                  delayLongPress={450}
                  style={[
                    styles.pickerGroupCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor:
                        groupSelectionMode && isGroupChecked
                          ? theme.emerald
                          : theme.border,
                    },
                  ]}
                >
                  {/* Checkbox ONLY shown when groupSelectionMode is active */}
                  {groupSelectionMode && (
                    <Pressable
                      onPress={() => togglePickerGroup(item.id)}
                      style={[
                        styles.selectCircle,
                        {
                          borderColor: theme.border,
                          backgroundColor: isGroupChecked ? theme.emerald : theme.canvas,
                        },
                      ]}
                      hitSlop={6}
                    >
                      {isGroupChecked && (
                        <Check size={13} color="#FFF" strokeWidth={3} />
                      )}
                    </Pressable>
                  )}

                  <View
                    style={[
                      styles.groupAvatar,
                      { backgroundColor: theme.mint },
                    ]}
                  >
                    <Users size={18} color={theme.emerald} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.pickerGroupName, { color: theme.ink }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.pickerGroupMeta, { color: theme.muted }]}
                      numberOfLines={1}
                    >
                      {item.contact_count || 0} contact(s)
                      {item.remark ? ` · ${item.remark}` : ''}
                    </Text>
                  </View>

                  {/* Plus/Chevron when in single click mode */}
                  {!groupSelectionMode && (
                    <View style={[styles.selectedBadge, { backgroundColor: theme.mint }]}>
                      <Plus size={12} color={theme.emerald} strokeWidth={2.5} />
                      <Text style={[styles.selectedBadgeText, { color: theme.emerald }]}>
                        Add
                      </Text>
                    </View>
                  )}
                </ScalePressable>
              );
            }}
          />

          {/* Bottom Confirmation Bar ONLY when groupSelectionMode is active */}
          {groupSelectionMode && (
            <View
              style={[
                styles.pickerBottomBar,
                { backgroundColor: theme.surface, borderTopColor: theme.border },
              ]}
            >
              <ScalePressable
                onPress={handleConfirmGroupPicker}
                disabled={!pickerSelectedGroups.length || bulkAssignLoading}
                style={[
                  styles.pickerConfirmBtn,
                  {
                    backgroundColor: pickerSelectedGroups.length
                      ? theme.emerald
                      : theme.muted,
                  },
                ]}
              >
                {bulkAssignLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.pickerConfirmBtnText}>
                    {groupPickerMode === 'bulk'
                      ? `Assign (${pickerSelectedGroups.length} Groups Selected)`
                      : `Add to ${pickerSelectedGroups.length} Group(s)`}
                  </Text>
                )}
              </ScalePressable>
            </View>
          )}
        </FadeInView>
      </KeyboardAvoidView>
    );
  }

  // =========================================================================
  // PAGE 2: EDIT CONTACT SEPARATE PAGE (Two Tabs: Profile Details & Manage Groups)
  // =========================================================================
  const editModalContent = editing ? (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <NativeKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardModalRoot}
        >
          <View style={styles.sheetBackdrop}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={theme.isDark ? 'dark' : 'light'}
              blurAmount={6}
              reducedTransparencyFallbackColor={theme.canvas}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {backgroundColor: theme.isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.16)'},
              ]}
            />
            <FadeInView
              direction="right"
              distance={12}
              duration={250}
              style={[
                styles.editModalSheet,
                isKeyboardVisible ? styles.expandedModalSheet : styles.collapsedModalSheet,
                {paddingTop: isKeyboardVisible ? insets.top : 0},
                {backgroundColor: theme.canvas},
              ]}
            >
          {/* Header */}
          <View
            {...editHeaderPanResponder.panHandlers}
            style={[
              styles.header,
              { backgroundColor: theme.canvas, borderBottomColor: theme.border },
            ]}
          >
            <ScalePressable
              onPress={closeEditModal}
              hitSlop={8}
              style={styles.backBtn}
            >
              <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
            </ScalePressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.ink }]}>
                Edit Contact
              </Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                {editing?.name ? `${editing.name} · ` : ''}{editing?.number || editing?.mobile || 'Contact details'}
              </Text>
            </View>
          </View>

          {/* Segmented Tab Switcher: Profile Details vs Manage Groups */}
          <View
            style={[
              styles.tabBar,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Pressable
              onPress={() => setEditTab('details')}
              style={[
                styles.tabBtn,
                editTab === 'details' && {
                  backgroundColor: theme.mint,
                },
              ]}
            >
              <User
                size={16}
                color={editTab === 'details' ? theme.emerald : theme.muted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: editTab === 'details' ? theme.emerald : theme.muted,
                  },
                ]}
              >
                Profile Details
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setEditTab('groups')}
              style={[
                styles.tabBtn,
                editTab === 'groups' && {
                  backgroundColor: theme.mint,
                },
              ]}
            >
              <Users
                size={16}
                color={editTab === 'groups' ? theme.emerald : theme.muted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: editTab === 'groups' ? theme.emerald : theme.muted,
                  },
                ]}
              >
                Manage Groups
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      editTab === 'groups' ? theme.emerald : theme.canvas,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    {
                      color: editTab === 'groups' ? '#FFF' : theme.muted,
                    },
                  ]}
                >
                  {assignedContactGroups.length}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* TAB 1: PROFILE DETAILS */}
          {editTab === 'details' && (
            <ScrollView
              contentContainerStyle={styles.editPageContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 1. Name Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <User size={13} color={theme.muted} />
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                    FULL NAME *
                  </Text>
                </View>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter contact full name"
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
              </View>

              {/* 2. Phone Number Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Phone size={13} color={theme.muted} />
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                    PHONE NUMBER *
                  </Text>
                </View>
                <TextInput
                  value={editNumber}
                  onChangeText={setEditNumber}
                  placeholder="e.g. 919876543210"
                  placeholderTextColor={theme.muted}
                  keyboardType="phone-pad"
                  style={[
                    styles.input,
                    {
                      color: theme.ink,
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                />
              </View>

              {/* 3. Company / Firm Name Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Building2 size={13} color={theme.muted} />
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                    FIRM / COMPANY NAME
                  </Text>
                </View>
                <TextInput
                  value={editFirmName}
                  onChangeText={setEditFirmName}
                  placeholder="Enter firm or company name"
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
              </View>

              {/* 4. Email Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Mail size={13} color={theme.muted} />
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                    EMAIL ADDRESS
                  </Text>
                </View>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Enter email address"
                  placeholderTextColor={theme.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    {
                      color: theme.ink,
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                />
              </View>

              {/* 5. Website URL Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Globe size={13} color={theme.muted} />
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                    WEBSITE
                  </Text>
                </View>
                <TextInput
                  value={editWebsite}
                  onChangeText={setEditWebsite}
                  placeholder="e.g. https://company.com"
                  placeholderTextColor={theme.muted}
                  keyboardType="url"
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    {
                      color: theme.ink,
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                />
              </View>

              {/* 6. Remark / Notes Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <FileText size={13} color={theme.muted} />
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                    REMARK / NOTES
                  </Text>
                </View>
                <TextInput
                  value={editRemark}
                  onChangeText={setEditRemark}
                  placeholder="Add private remarks or notes about this contact..."
                  placeholderTextColor={theme.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.textArea,
                    {
                      color: theme.ink,
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                />
              </View>

              {/* Save Button for Profile Details */}
              <ScalePressable
                onPress={saveEdit}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: theme.emerald }]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Profile Details</Text>
                )}
              </ScalePressable>
            </ScrollView>
          )}

          {/* TAB 2: MANAGE GROUPS */}
          {editTab === 'groups' && (
            <ScrollView
              contentContainerStyle={styles.editPageContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Action Bar */}
              <View style={styles.groupsHeaderRow}>
                <View style={styles.labelRow}>
                  <Users size={15} color={theme.emerald} />
                  <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 }]}>
                    ASSIGNED GROUPS ({assignedContactGroups.length})
                  </Text>
                </View>
                <ScalePressable
                  onPress={openEditGroupPicker}
                  style={[styles.chooseGroupsBtn, { backgroundColor: theme.mint }]}
                  hitSlop={6}
                >
                  <Plus size={15} color={theme.emerald} />
                  <Text
                    style={[styles.chooseGroupsBtnText, { color: theme.emerald }]}
                  >
                    + Assign to Group
                  </Text>
                </ScalePressable>
              </View>

              {/* Loader when fetching assigned groups */}
              {loadingContactGroups ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.emerald} />
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8 }}>
                    Loading assigned groups...
                  </Text>
                </View>
              ) : assignedContactGroups.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {assignedContactGroups.map((grp) => {
                    const gid = String(grp.group_id || grp.id);
                    const gName = grp.name || `Group ${gid}`;
                    const isRemoving = removingGroupId === gid;

                    return (
                      <View
                        key={gid}
                        style={[
                          styles.assignedGroupCard,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.groupAvatar,
                            { backgroundColor: theme.mint },
                          ]}
                        >
                          <Users size={18} color={theme.emerald} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.pickerGroupName, { color: theme.ink }]}
                            numberOfLines={1}
                          >
                            {gName}
                          </Text>
                          {grp.remark ? (
                            <Text
                              style={[styles.pickerGroupMeta, { color: theme.muted }]}
                              numberOfLines={1}
                            >
                              {grp.remark}
                            </Text>
                          ) : null}
                        </View>

                        <Pressable
                          onPress={() => handleRemoveGroupFromContact(grp)}
                          disabled={isRemoving}
                          hitSlop={8}
                          style={styles.groupDeleteBtn}
                        >
                          {isRemoving ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Trash2 size={17} color="#DC2626" />
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={[
                    styles.noGroupsPlaceholder,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      paddingVertical: 32,
                    },
                  ]}
                >
                  <Users size={32} color={theme.muted} />
                  <Text
                    style={[
                      styles.noGroupsPlaceholderText,
                      { color: theme.ink, fontWeight: '700', fontSize: 14, textAlign: 'center' },
                    ]}
                  >
                    No Groups Assigned
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.muted,
                      textAlign: 'center',
                      lineHeight: 17,
                      paddingHorizontal: 20,
                      marginTop: 2,
                      marginBottom: 10,
                    }}
                  >
                    This contact is not in any group. Tap "+ Assign to Group" to link them with groups.
                  </Text>
                  <ScalePressable
                    onPress={openEditGroupPicker}
                    style={[styles.chooseGroupsBtn, { backgroundColor: theme.mint, paddingHorizontal: 16, paddingVertical: 9 }]}
                  >
                    <Plus size={16} color={theme.emerald} />
                    <Text style={[styles.chooseGroupsBtnText, { color: theme.emerald, fontSize: 13 }]}>
                      + Assign to Group
                    </Text>
                  </ScalePressable>
                </View>
              )}
            </ScrollView>
          )}
            </FadeInView>
          </View>
        </NativeKeyboardAvoidingView>
      </Modal>
    ) : null;

  // =========================================================================
  // PAGE 3: MAIN CONTACTS LIST PAGE
  // =========================================================================
  const renderContact = ({ item, index }: { item: any; index: number }) => {
    const id = idOf(item);
    const checked = selected.includes(id);
    const contactNum = String(item.number || item.mobile || '');
    const contactName = String(item.name || contactNum || 'Unnamed Contact');

    return (
      <FadeInView delay={Math.min(index * 35, 250)} distance={12} duration={280}>
        <ScalePressable
          accessibilityRole="button"
          onLongPress={() => {
            if (!showFavorites) {
              setSelectionMode(true);
              setSelected([id]);
            }
          }}
          delayLongPress={450}
          onPress={() => {
            if (selectionMode) {
              toggle(id);
            } else if (contactNum && onOpenChat) {
              onOpenChat(contactNum, contactName);
            }
          }}
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: checked ? theme.emerald : theme.border,
            },
          ]}
        >
          {/* Checkbox circle when in selectionMode */}
          {selectionMode && (
            <Pressable
              onPress={() => toggle(id)}
              style={[
                styles.selectCircle,
                {
                  borderColor: theme.border,
                  backgroundColor: checked ? theme.emerald : theme.canvas,
                },
              ]}
              hitSlop={6}
            >
              {checked && <Check size={13} color="#FFF" strokeWidth={3} />}
            </Pressable>
          )}

          {/* Contact Avatar */}
          <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
            <Text style={[styles.avatarText, { color: theme.mintText }]}>
              {contactName.trim().charAt(0).toUpperCase() || 'C'}
            </Text>
          </View>

          {/* Contact Details */}
          <View style={styles.cardBody}>
            <View style={styles.cardHeaderRow}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.ink, flex: 1 }]}>
                {contactName}
              </Text>
              {item.firm_name ? (
                <Text numberOfLines={1} style={[styles.firmBadge, { color: theme.emerald, backgroundColor: theme.mint }]}>
                  {item.firm_name}
                </Text>
              ) : null}
            </View>

            <Text numberOfLines={1} style={[styles.meta, { color: theme.muted }]}>
              {contactNum || '-'}
            </Text>

            {item.email ? (
              <Text numberOfLines={1} style={[styles.emailMeta, { color: theme.muted }]}>
                {item.email}
              </Text>
            ) : null}
          </View>

          {/* Contact actions */}
          {!selectionMode && (
            <View style={styles.contactActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More actions for ${contactName}`}
                onPress={(event) => {
                  event.stopPropagation();
                  setActionMenuContact(item);
                }}
                style={[styles.editBtn, { backgroundColor: theme.canvas }]}
                hitSlop={6}
              >
                <MoreVertical size={20} color={theme.ink} />
              </Pressable>
            </View>
          )}
        </ScalePressable>
      </FadeInView>
    );
  };

  return (
    <KeyboardAvoidView
      style={[styles.container, { backgroundColor: theme.canvas }]}
    >
      {/* Top Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.header, borderBottomColor: theme.border },
        ]}
      >
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.ink }]}>
            {showFavorites ? 'Favorite Contacts' : 'All Contacts'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {showFavorites
              ? 'Your starred project contacts'
              : 'Tap to chat · Press and hold to select'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showFavorites ? 'Show all contacts' : 'Show favorite contacts'}
          onPress={() => {
            setShowFavorites((current) => !current);
            setSelected([]);
            setSelectionMode(false);
            setPage(1);
            setHasMore(true);
          }}
          style={[
            styles.headerAction,
            { backgroundColor: showFavorites ? theme.mint : theme.surface },
          ]}
          hitSlop={6}
        >
          <Star
            size={18}
            color={showFavorites ? theme.emerald : theme.muted}
            fill={showFavorites ? theme.emerald : 'transparent'}
          />
        </Pressable>
        {!showFavorites && !selectionMode && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create contact"
            onPress={() => setCreateModalVisible(true)}
            style={[styles.headerAction, { backgroundColor: theme.emerald }]}
            hitSlop={6}
          >
            <Plus size={20} color="#FFF" strokeWidth={2.5} />
          </Pressable>
        )}
      </View>

      {/* Search Row */}
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
          placeholder="Search contacts by name, number..."
          placeholderTextColor={theme.muted}
          style={[styles.searchInput, { color: theme.ink }]}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <X size={16} color={theme.muted} />
          </Pressable>
        )}
      </View>

      {/* Selection Mode Toolbar (matches OpenCasesScreen UX) */}
      {selectionMode && (
        <View
          style={[
            styles.bulkBar,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <View>
            <Text style={[styles.bulkTitle, { color: theme.ink }]}>
              {selected.length} Selected
            </Text>
            <Text style={[styles.bulkSubtitle, { color: theme.muted }]}>
              Choose contacts for group assignment
            </Text>
          </View>

          <View style={styles.selectionActions}>
            <Pressable
              onPress={confirmDeleteSelected}
              disabled={!selected.length || bulkAssignLoading}
              style={[styles.cancelButton, { borderColor: '#FCA5A5' }]}
              hitSlop={4}
            >
              <Text style={[styles.selectAllText, { color: '#DC2626' }]}>
                Delete
              </Text>
            </Pressable>
            <Pressable
              onPress={toggleSelectAll}
              style={[styles.selectAllButton, { borderColor: theme.border }]}
              hitSlop={4}
            >
              <Text style={[styles.selectAllText, { color: theme.ink }]}>
                {selected.length === contacts.length && contacts.length > 0
                  ? 'Clear all'
                  : 'Select all'}
              </Text>
            </Pressable>

            <Pressable
              onPress={cancelSelection}
              style={[styles.cancelButton, { borderColor: theme.border }]}
              hitSlop={4}
            >
              <Text style={[styles.selectAllText, { color: theme.muted }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Contacts List */}
      <FlatList
        data={contacts}
        keyExtractor={(item, index) => String(idOf(item) || item.number || index) + '-' + index}
        renderItem={renderContact}
        refreshControl={
          <RefreshControl
            refreshing={loading && contacts.length > 0}
            onRefresh={load}
            tintColor={theme.emerald}
          />
        }
        contentContainerStyle={
          contacts.length ? styles.listContent : styles.emptyListContent
        }
        onEndReached={handleLoadMoreContacts}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <LoadState
            loading={loading}
            skeleton="contact"
            error={error}
            empty={!contacts.length}
            emptyTitle="No contacts found"
            emptyCopy={
              search
                ? 'No contacts match your search query.'
                : 'Your contact list is currently empty.'
            }
            onRetry={load}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.emerald} />
              <Text style={[styles.footerLoaderText, { color: theme.muted }]}>
                Loading more contacts...
              </Text>
            </View>
          ) : null
        }
      />

      {/* Selection Mode Action FAB */}
      {selectionMode && (
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="Assign selected contacts to groups"
          onPress={openBulkGroupPicker}
          disabled={!selected.length || bulkAssignLoading}
          style={[
            styles.bulkFab,
            {
              backgroundColor: selected.length ? theme.emerald : theme.muted,
            },
          ]}
        >
          {bulkAssignLoading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Users size={20} color="#FFF" />
              <Text style={styles.bulkFabText}>
                Assign Groups ({selected.length})
              </Text>
            </>
          )}
        </ScalePressable>
      )}

      <Modal
        visible={actionMenuContact !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenuContact(null)}
      >
        <Pressable
          style={styles.actionMenuBackdrop}
          onPress={() => setActionMenuContact(null)}
        >
          <Pressable
            style={[styles.actionMenu, {backgroundColor: theme.surface, borderColor: theme.border}]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.actionMenuTitle, {color: theme.ink}]} numberOfLines={1}>
              {actionMenuContact?.name || actionMenuContact?.number || 'Contact actions'}
            </Text>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                const contact = actionMenuContact;
                setActionMenuContact(null);
                if (contact) handleToggleFavorite(contact);
              }}
            >
              <Star
                size={18}
                color={
                  favoriteNumbers.has(
                    String(actionMenuContact?.number || actionMenuContact?.mobile || ''),
                  )
                    ? '#E6A700'
                    : theme.muted
                }
                fill={
                  favoriteNumbers.has(
                    String(actionMenuContact?.number || actionMenuContact?.mobile || ''),
                  )
                    ? '#E6A700'
                    : 'transparent'
                }
              />
              <Text style={[styles.actionMenuLabel, {color: theme.ink}]}>
                {favoriteNumbers.has(
                  String(actionMenuContact?.number || actionMenuContact?.mobile || ''),
                )
                  ? 'Remove from favorites'
                  : 'Add to favorites'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                const contact = actionMenuContact;
                setActionMenuContact(null);
                if (contact) openEdit(contact);
              }}
            >
              <Edit2 size={18} color={theme.emerald} />
              <Text style={[styles.actionMenuLabel, {color: theme.ink}]}>Edit contact</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                const contact = actionMenuContact;
                setActionMenuContact(null);
                if (contact) confirmDeleteContact(contact);
              }}
            >
              <Trash2 size={18} color="#DC2626" />
              <Text style={[styles.actionMenuLabel, {color: '#DC2626'}]}>Delete contact</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <NativeKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardModalRoot}
        >
          <View style={styles.sheetBackdrop}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={theme.isDark ? 'dark' : 'light'}
              blurAmount={6}
              reducedTransparencyFallbackColor={theme.canvas}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {backgroundColor: theme.isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.16)'},
              ]}
            />
          <View
            style={[
              styles.createModal,
              isKeyboardVisible ? styles.expandedModalSheet : styles.collapsedModalSheet,
              {paddingTop: isKeyboardVisible ? insets.top : 20},
              { backgroundColor: theme.canvas },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{flex: 1}}>
                <Text style={[styles.title, {color: theme.ink}]}>Create Contact</Text>
                <Text style={[styles.subtitle, {color: theme.muted}]}>
                  Add a project contact manually or from your phonebook.
                </Text>
              </View>
              <Pressable onPress={() => setCreateModalVisible(false)} hitSlop={8}>
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={loadDeviceContacts}
              disabled={deviceContactsLoading}
              style={[styles.deviceContactButton, {backgroundColor: theme.mint}]}
            >
              {deviceContactsLoading ? (
                <ActivityIndicator size="small" color={theme.emerald} />
              ) : (
                <Smartphone size={18} color={theme.emerald} />
              )}
              <Text style={[styles.deviceContactButtonText, {color: theme.emerald}]}>
                Choose from device contacts
              </Text>
            </Pressable>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.createForm}
            >
              {[
                {label: 'Name *', value: newName, change: setNewName, placeholder: 'Contact name'},
                {label: 'Phone number *', value: newNumber, change: setNewNumber, placeholder: 'Include country code', phone: true},
                {label: 'Email', value: newEmail, change: setNewEmail, placeholder: 'Email address', email: true},
                {label: 'Firm / company', value: newFirmName, change: setNewFirmName, placeholder: 'Firm or company name'},
                {label: 'Website', value: newWebsite, change: setNewWebsite, placeholder: 'Website URL'},
                {label: 'Remark', value: newRemark, change: setNewRemark, placeholder: 'Notes (optional)'},
              ].map((field) => (
                <View key={field.label} style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, {color: theme.muted}]}>{field.label}</Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.change}
                    placeholder={field.placeholder}
                    placeholderTextColor={theme.muted}
                    keyboardType={field.phone ? 'phone-pad' : field.email ? 'email-address' : 'default'}
                    autoCapitalize={field.email ? 'none' : 'sentences'}
                    style={[
                      styles.input,
                      {color: theme.ink, borderColor: theme.border, backgroundColor: theme.surface},
                    ]}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => {
                  setCreateModalVisible(false);
                  resetCreateForm();
                }}
                style={[styles.modalSecondaryButton, {borderColor: theme.border}]}
              >
                <Text style={[styles.selectAllText, {color: theme.muted}]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateContact}
                disabled={creatingContact}
                style={[styles.modalPrimaryButton, {backgroundColor: theme.emerald}]}
              >
                {creatingContact ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.pickerConfirmBtnText}>Create contact</Text>
                )}
              </Pressable>
            </View>
          </View>
          </View>
        </NativeKeyboardAvoidingView>
      </Modal>

      <Modal
        visible={deviceContactsVisible}
        animationType="slide"
        onRequestClose={() => setDeviceContactsVisible(false)}
      >
        <View style={[styles.devicePicker, {backgroundColor: theme.canvas}]}>
          <View style={[styles.header, {backgroundColor: theme.header, borderBottomColor: theme.border}]}>
            <Pressable onPress={() => setDeviceContactsVisible(false)} style={styles.backBtn} hitSlop={8}>
              <ArrowLeft size={22} color={theme.ink} />
            </Pressable>
            <View style={{flex: 1}}>
              <Text style={[styles.title, {color: theme.ink}]}>Device Contacts</Text>
              <Text style={[styles.subtitle, {color: theme.muted}]}>Select a phonebook entry</Text>
            </View>
          </View>
          <View style={[styles.searchRow, {borderColor: theme.border, backgroundColor: theme.surface}]}>
            <Search size={17} color={theme.muted} />
            <TextInput
              value={deviceContactsSearch}
              onChangeText={setDeviceContactsSearch}
              placeholder="Search device contacts"
              placeholderTextColor={theme.muted}
              style={[styles.searchInput, {color: theme.ink}]}
            />
          </View>
          <FlatList
            data={filteredDeviceContacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.deviceContactsEmpty, {color: theme.muted}]}>
                No device contacts with a valid phone number found.
              </Text>
            }
            renderItem={({item}) => (
              <Pressable
                onPress={() => handleSelectDeviceContact(item)}
                style={[styles.deviceContactRow, {backgroundColor: theme.surface, borderColor: theme.border}]}
              >
                <View style={[styles.avatar, {backgroundColor: theme.mint}]}>
                  <Text style={[styles.avatarText, {color: theme.mintText}]}>
                    {item.name.charAt(0).toUpperCase() || 'C'}
                  </Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={[styles.name, {color: theme.ink}]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.meta, {color: theme.muted}]} numberOfLines={1}>{item.number}</Text>
                </View>
                <Check size={18} color={theme.emerald} />
              </Pressable>
            )}
          />
        </View>
      </Modal>
      {editModalContent}
    </KeyboardAvoidView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginRight: 8,
  },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, marginTop: 1 },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  searchRow: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },

  // Bulk Selection Header Bar (matches OpenCasesScreen)
  bulkBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  bulkTitle: { fontSize: 16, fontWeight: '800' },
  bulkSubtitle: { fontSize: 11, marginTop: 1 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 8,
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 8,
  },
  selectAllText: { fontSize: 12, fontWeight: '800' },

  // List & Cards
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 90,
    gap: 10,
  },
  emptyListContent: { flexGrow: 1, paddingHorizontal: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800' },
  cardBody: { flex: 1, marginLeft: 12 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  firmBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 2 },
  emailMeta: { fontSize: 11, marginTop: 1 },
  editBtn: {
    padding: 8,
    borderRadius: 10,
    marginLeft: 6,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  actionMenuBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  actionMenu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  actionMenuTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  actionMenuItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  actionMenuLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  keyboardModalRoot: {flex: 1},
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editModalSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  collapsedModalSheet: {
    height: '60%',
    maxHeight: '60%',
  },
  expandedModalSheet: {
    flex: 1,
  },
  createModal: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  deviceContactButton: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginBottom: 12,
  },
  deviceContactButtonText: {fontSize: 13, fontWeight: '800'},
  createForm: {gap: 12, paddingBottom: 16},
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    paddingBottom: 12,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButton: {
    flex: 1.5,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devicePicker: {flex: 1},
  deviceContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 12,
  },
  deviceContactsEmpty: {
    textAlign: 'center',
    padding: 24,
    fontSize: 14,
  },

  // Bulk Action FAB
  bulkFab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    minWidth: 160,
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  bulkFabText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  // Choose Groups Separate Page
  pickerAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 8,
  },
  pickerAllBtnText: { fontSize: 12, fontWeight: '800' },
  pickerListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 30,
    gap: 8,
  },
  pickerGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerGroupName: { fontSize: 15, fontWeight: '800' },
  pickerGroupMeta: { fontSize: 12, marginTop: 2 },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyGroupsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyGroupsTitle: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyGroupsSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 30,
  },
  pickerBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  pickerConfirmBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerConfirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // Edit Contact Separate Page
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignedGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  groupDeleteBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPageContent: {
    padding: 18,
    gap: 14,
    paddingBottom: 40,
  },
  formGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    fontSize: 14,
  },
  groupsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chooseGroupsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chooseGroupsBtnText: { fontSize: 12, fontWeight: '800' },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  groupChipText: { fontSize: 12, fontWeight: '700', maxWidth: 140 },
  noGroupsPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  noGroupsPlaceholderText: { fontSize: 13 },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  footerLoader: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoaderText: { fontSize: 12 },
});
