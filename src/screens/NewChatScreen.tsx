import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Contacts from 'react-native-contacts';
import Toast from '../ui/toast';
import { ArrowLeft, Search, Smartphone, X } from 'lucide-react-native';
import { useTheme } from '../theme/theme';
import { ScalePressable, FadeInView, SlideUpModal } from '../components/animations';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';

type Props = {
  onBack: () => void;
  onStartChat: (contactNumber: string, contactName: string) => void;
};

export function NewChatScreen({ onBack, onStartChat }: Props) {
  const theme = useTheme();
  const [newChatNumber, setNewChatNumber] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [deviceContactsModalOpen, setDeviceContactsModalOpen] = useState(false);
  const [deviceContactsList, setDeviceContactsList] = useState<Array<{ id: string; name: string; number: string }>>([]);
  const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);
  const [deviceContactsSearch, setDeviceContactsSearch] = useState('');

  const loadDeviceContacts = useCallback(async () => {
    setLoadingDeviceContacts(true);
    try {
      let hasPermission = false;
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts Permission',
            message: 'OneChat needs access to your device contacts to start direct chats easily.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        hasPermission = true;
      }

      if (!hasPermission) {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Please grant contacts permission to select from device contacts.',
        });
        return;
      }

      const raw = await Contacts.getAllWithoutPhotos();
      const parsed: Array<{ id: string; name: string; number: string }> = [];
      const seen = new Set<string>();

      raw.forEach((c) => {
        const fullName = [c.givenName, c.middleName, c.familyName]
          .filter(Boolean)
          .join(' ')
          .trim() || c.displayName || 'Unnamed Contact';

        if (Array.isArray(c.phoneNumbers)) {
          c.phoneNumbers.forEach((pn) => {
            const rawNum = pn.number || '';
            const cleaned = rawNum.replace(/[^0-9+]/g, '');
            if (cleaned.length >= 7) {
              const key = `${fullName}-${cleaned}`;
              if (!seen.has(key)) {
                seen.add(key);
                parsed.push({
                  id: `${c.recordID || ''}-${pn.label || ''}-${cleaned}`,
                  name: fullName,
                  number: cleaned,
                });
              }
            }
          });
        }
      });

      parsed.sort((a, b) => a.name.localeCompare(b.name));
      setDeviceContactsList(parsed);
      setDeviceContactsModalOpen(true);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load contacts',
        text2: err?.message || 'Failed to read contacts from device.',
      });
    } finally {
      setLoadingDeviceContacts(false);
    }
  }, []);

  const filteredDeviceContacts = useMemo(() => {
    if (!deviceContactsSearch.trim()) return deviceContactsList;
    const q = deviceContactsSearch.toLowerCase().trim();
    return deviceContactsList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q),
    );
  }, [deviceContactsList, deviceContactsSearch]);

  const handleDirectChat = () => {
    if (!newChatNumber.trim()) return;
    onStartChat(newChatNumber.trim(), newChatName.trim() || newChatNumber.trim());
  };

  const handleSelectDeviceContact = (contact: { name: string; number: string }) => {
    setDeviceContactsModalOpen(false);
    onStartChat(contact.number, contact.name || contact.number);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.fullScreen, { backgroundColor: theme.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FadeInView direction="up" distance={12} duration={250} style={{ flex: 1 }}>
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <ScalePressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.ink} strokeWidth={2.5} />
          </ScalePressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>New Chat</Text>
            <Text style={[styles.modalHeaderSubtitle, { color: theme.muted }]}>
              Start a direct WhatsApp conversation
            </Text>
          </View>
        </View>

        <View style={styles.fullScreenBody}>
          {/* Option: Pick from Device Contacts */}
          <ScalePressable
            style={[
              styles.deviceContactBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.emerald,
              },
            ]}
            onPress={loadDeviceContacts}
            disabled={loadingDeviceContacts}
          >
            <View style={[styles.deviceContactIconWrap, { backgroundColor: theme.mint }]}>
              {loadingDeviceContacts ? (
                <ActivityIndicator size="small" color={theme.emerald} />
              ) : (
                <Smartphone size={22} color={theme.emerald} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.deviceContactBtnTitle, { color: theme.ink }]}>
                Choose from Device Contacts
              </Text>
              <Text style={[styles.deviceContactBtnSubtitle, { color: theme.muted }]}>
                Select a contact directly from your phonebook
              </Text>
            </View>
            <Text style={{ color: theme.emerald, fontSize: 20, fontWeight: '700' }}>›</Text>
          </ScalePressable>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.muted, backgroundColor: theme.canvas }]}>
              OR ENTER MANUALLY
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
            Enter a phone number with country code to start a new direct chat.
          </Text>

          <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.modalInput, { color: theme.ink }]}
              placeholder="Phone Number (e.g. 919876543210)"
              placeholderTextColor={theme.muted}
              keyboardType="phone-pad"
              value={newChatNumber}
              onChangeText={setNewChatNumber}
              returnKeyType="next"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.modalInput, { color: theme.ink }]}
              placeholder="Contact Name (Optional)"
              placeholderTextColor={theme.muted}
              value={newChatName}
              onChangeText={setNewChatName}
              returnKeyType="done"
              onSubmitEditing={handleDirectChat}
            />
          </View>

          <ScalePressable
            style={[styles.modalButton, { backgroundColor: theme.emerald }]}
            onPress={handleDirectChat}
          >
            <Text style={styles.modalButtonText}>Start Conversation</Text>
          </ScalePressable>
        </View>
      </FadeInView>

      {/* Device Contacts Selection Modal */}
      <SlideUpModal
        visible={deviceContactsModalOpen}
        onClose={() => setDeviceContactsModalOpen(false)}
        maxHeight="85%"
      >
        <KeyboardAvoidView style={{ flex: 0 }}>
          <View style={[styles.deviceModalContainer, { backgroundColor: theme.surface }]}>
            <View style={[styles.deviceModalHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.deviceModalTitle, { color: theme.ink }]}>
                  Device Contacts
                </Text>
                <Text style={[styles.deviceModalSubtitle, { color: theme.muted }]}>
                  {deviceContactsList.length} contacts found
                </Text>
              </View>
              <ScalePressable
                onPress={() => setDeviceContactsModalOpen(false)}
                hitSlop={8}
                style={styles.deviceModalBackBtn}
              >
                <X size={20} color={theme.muted} />
              </ScalePressable>
            </View>

            {/* Search bar */}
            <View style={[styles.deviceSearchRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
              <Search size={16} color={theme.muted} />
              <TextInput
                style={[styles.deviceSearchInput, { color: theme.ink }]}
                placeholder="Search by name or number..."
                placeholderTextColor={theme.muted}
                value={deviceContactsSearch}
                onChangeText={setDeviceContactsSearch}
              />
              {deviceContactsSearch.length > 0 && (
                <Pressable onPress={() => setDeviceContactsSearch('')} hitSlop={8}>
                  <X size={16} color={theme.muted} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filteredDeviceContacts}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 380 }}
              contentContainerStyle={styles.deviceListContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.deviceEmptyWrap}>
                  <Smartphone size={36} color={theme.muted} />
                  <Text style={[styles.deviceEmptyTitle, { color: theme.ink }]}>
                    {deviceContactsSearch ? 'No matching contacts' : 'No contacts found'}
                  </Text>
                  <Text style={[styles.deviceEmptySubtitle, { color: theme.muted }]}>
                    {deviceContactsSearch
                      ? 'Try searching with a different name or number.'
                      : 'No valid phone numbers found in your device contacts.'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <ScalePressable
                  style={[
                    styles.deviceContactCard,
                    { backgroundColor: theme.canvas, borderColor: theme.border },
                  ]}
                  onPress={() => handleSelectDeviceContact(item)}
                >
                  <View style={[styles.deviceContactAvatar, { backgroundColor: theme.mint }]}>
                    <Text style={[styles.deviceContactAvatarText, { color: theme.mintText }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deviceContactName, { color: theme.ink }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.deviceContactNumber, { color: theme.muted }]} numberOfLines={1}>
                      {item.number}
                    </Text>
                  </View>
                  <View style={[styles.deviceChatBadge, { backgroundColor: theme.mint }]}>
                    <Text style={[styles.deviceChatBadgeText, { color: theme.emerald }]}>Chat</Text>
                  </View>
                </ScalePressable>
              )}
            />
          </View>
        </KeyboardAvoidView>
      </SlideUpModal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  fullScreenBody: {
    padding: 20,
    gap: 16,
  },
  deviceContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  deviceContactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceContactBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  deviceContactBtnSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  modalInput: {
    fontSize: 15,
    paddingVertical: 8,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deviceModalContainer: {
    width: '100%',
    paddingBottom: 16,
  },
  deviceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  deviceModalBackBtn: {
    padding: 4,
    marginRight: 10,
  },
  deviceModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  deviceModalSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  deviceSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    height: 40,
    gap: 8,
  },
  deviceSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  deviceListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  deviceContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  deviceContactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceContactAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  deviceContactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  deviceContactNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  deviceChatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deviceChatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deviceEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 8,
  },
  deviceEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  deviceEmptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
});
