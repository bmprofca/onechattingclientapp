import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, PhoneCall, MessageCircle, Mail, HelpCircle } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getSupportInfo, SupportData } from '../api/company';
import { useTheme } from '../theme/theme';
import Toast from 'react-native-toast-message';

export function SupportScreen({
  session,
  onBack,
}: {
  session: ApiSession;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [data, setData] = useState<SupportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSupport();
  }, []);

  const loadSupport = async () => {
    setLoading(true);
    try {
      const res: any = await getSupportInfo(session);
      if (res.data) {
        setData(res.data);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Load Failed',
        text2: 'Could not fetch support information.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (type: 'phone' | 'whatsapp' | 'email', value: string) => {
    let url = '';
    if (type === 'phone') url = `tel:+${value}`;
    if (type === 'whatsapp') url = `whatsapp://send?phone=${value}`;
    if (type === 'email') url = `mailto:${value}`;

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Toast.show({ type: 'error', text1: 'Action Unavailable', text2: `Cannot open ${type} link on this device.` });
      }
    });
  };

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Help Center</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: theme.mint }]}>
            <HelpCircle size={32} color={theme.emerald} strokeWidth={2} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.ink }]}>How can we help?</Text>
          <Text style={[styles.heroDesc, { color: theme.muted }]}>Choose a channel below to get in touch with our support teams.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.emerald} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.contactContainer}>
            {data?.phone && data.phone.length > 0 && (
              <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <View style={styles.sectionHeader}>
                  <PhoneCall size={20} color={theme.emerald} />
                  <Text style={[styles.sectionTitle, { color: theme.ink }]}>Phone Support</Text>
                </View>
                {data.phone.map((contact, idx) => (
                  <Pressable 
                    key={`phone-${idx}`}
                    onPress={() => handlePress('phone', contact.number!)}
                    style={[styles.contactCard, { borderTopColor: theme.border }]}
                  >
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactType, { color: theme.ink }]}>{contact.type}</Text>
                      <Text style={[styles.contactValue, { color: theme.muted }]}>+{contact.number}</Text>
                    </View>
                    <Text style={[styles.actionText, { color: theme.emerald }]}>Call</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {data?.whatsapp && data.whatsapp.length > 0 && (
              <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <View style={styles.sectionHeader}>
                  <MessageCircle size={20} color={theme.emerald} />
                  <Text style={[styles.sectionTitle, { color: theme.ink }]}>WhatsApp Support</Text>
                </View>
                {data.whatsapp.map((contact, idx) => (
                  <Pressable 
                    key={`wa-${idx}`}
                    onPress={() => handlePress('whatsapp', contact.number!)}
                    style={[styles.contactCard, { borderTopColor: theme.border }]}
                  >
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactType, { color: theme.ink }]}>{contact.type}</Text>
                      <Text style={[styles.contactValue, { color: theme.muted }]}>+{contact.number}</Text>
                    </View>
                    <Text style={[styles.actionText, { color: theme.emerald }]}>Message</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {data?.email && data.email.length > 0 && (
              <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <View style={styles.sectionHeader}>
                  <Mail size={20} color={theme.emerald} />
                  <Text style={[styles.sectionTitle, { color: theme.ink }]}>Email Support</Text>
                </View>
                {data.email.map((contact, idx) => (
                  <Pressable 
                    key={`email-${idx}`}
                    onPress={() => handlePress('email', contact.email!)}
                    style={[styles.contactCard, { borderTopColor: theme.border }]}
                  >
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactType, { color: theme.ink }]}>{contact.type}</Text>
                      <Text style={[styles.contactValue, { color: theme.muted }]}>{contact.email}</Text>
                    </View>
                    <Text style={[styles.actionText, { color: theme.emerald }]}>Email</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  page: { padding: 20, paddingBottom: 40 },
  heroCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  contactContainer: {
    gap: 16,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  contactInfo: {
    flex: 1,
  },
  contactType: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 13,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 12,
  },
});
