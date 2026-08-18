import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Linking } from 'react-native';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import Toast from 'react-native-toast-message';
import { ArrowLeft, MessageSquare, Globe, Link as LinkIcon, CheckCircle2 } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { embedSignup, submitWabaId, getWabaInformation } from '../api/workspace';
import { useTheme } from '../theme/theme';

export function WabaOnboardingScreen({
  session,
  projectId,
  onBack,
}: {
  session: ApiSession;
  projectId: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [loadingLink, setLoadingLink] = useState(false);
  const [submittingId, setSubmittingId] = useState(false);
  const [wabaId, setWabaId] = useState('');
  const [wabaInfo, setWabaInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => {
    loadWabaInfo();
  }, []);

  const loadWabaInfo = async () => {
    setLoadingInfo(true);
    try {
      const res = await getWabaInformation(session, projectId);
      if (!res.error && res.data) {
        setWabaInfo(res.data);
      }
    } catch (e) {
      // It might not be linked yet, so ignore error.
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoadingLink(true);
    try {
      const res = await embedSignup(session, projectId);
      if (res.error) throw new Error(res.msg || 'Failed to generate link');
      
      const url = res.url || res.data?.url;
      if (url) {
        Linking.openURL(url);
        Toast.show({ type: 'success', text1: 'Browser Opened', text2: 'Please complete the Meta signup flow in your browser.' });
      } else {
        throw new Error('No URL returned from server');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Generation Failed',
        text2: error instanceof Error ? error.message : 'Unable to generate signup link.',
      });
    } finally {
      setLoadingLink(false);
    }
  };

  const handleSubmitWabaId = async () => {
    if (!wabaId.trim()) {
      Toast.show({ type: 'error', text1: 'Missing ID', text2: 'Please enter your WABA ID.' });
      return;
    }
    setSubmittingId(true);
    try {
      const res = await submitWabaId(session, projectId, wabaId.trim());
      if (res.error) throw new Error(res.msg || 'Failed to connect WABA');
      
      Toast.show({ type: 'success', text1: 'WABA Connected', text2: 'Your WhatsApp Business Account is now linked.' });
      loadWabaInfo(); // Refresh the info
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: error instanceof Error ? error.message : 'Unable to connect WABA ID.',
      });
    } finally {
      setSubmittingId(false);
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>WhatsApp Account</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidView style={styles.keyboardArea}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={[styles.heroIcon, { backgroundColor: '#E0F2FE' }]}>
            <MessageSquare size={32} color="#0284C7" strokeWidth={2} />
          </View>
          
          <Text style={[styles.title, { color: theme.ink }]}>Connect with Meta</Text>
          <Text style={[styles.copy, { color: theme.muted }]}>Complete the Meta Embedded Signup to get your WhatsApp Business Account (WABA) verified and running.</Text>

          {loadingInfo ? (
            <ActivityIndicator color={theme.emerald} style={{ marginVertical: 40 }} />
          ) : wabaInfo?.business_verification_status ? (
            <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.statusHeader}>
                <CheckCircle2 size={24} color={theme.emerald} />
                <Text style={[styles.statusTitle, { color: theme.ink }]}>Account Connected</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.muted }]}>Name</Text>
                <Text style={[styles.statusValue, { color: theme.ink }]}>{wabaInfo.name || wabaInfo.business_info?.name || 'Unknown'}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.muted }]}>Verification</Text>
                <Text style={[styles.statusValue, { color: wabaInfo.business_verification_status === 'VERIFIED' ? theme.emerald : theme.warning }]}>{wabaInfo.business_verification_status}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: theme.muted }]}>Review Status</Text>
                <Text style={[styles.statusValue, { color: theme.ink }]}>{wabaInfo.account_review_status}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
              
              <View style={styles.stepBlock}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepNumber, { backgroundColor: theme.mint }]}><Text style={[styles.stepNumberText, { color: theme.emerald }]}>1</Text></View>
                  <Text style={[styles.stepTitle, { color: theme.ink }]}>Generate Signup Link</Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.muted }]}>Tap below to securely connect your Facebook account and create your WABA profile.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingLink}
                  onPress={handleGenerateLink}
                  style={({ pressed }) => [
                    styles.facebookButton,
                    pressed && !loadingLink && styles.buttonPressed,
                    loadingLink && styles.disabled,
                  ]}
                >
                  {loadingLink ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Globe size={20} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.buttonText}>Continue with Facebook</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.stepBlock}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepNumber, { backgroundColor: theme.mint }]}><Text style={[styles.stepNumberText, { color: theme.emerald }]}>2</Text></View>
                  <Text style={[styles.stepTitle, { color: theme.ink }]}>Submit WABA ID</Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.muted }]}>After completing the signup, copy your new WABA ID and paste it below.</Text>
                
                <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <LinkIcon size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={wabaId}
                    onChangeText={setWabaId}
                    placeholder="Enter WABA ID"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={submittingId}
                  onPress={handleSubmitWabaId}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: theme.emerald, shadowColor: theme.emeraldDark },
                    pressed && !submittingId && styles.buttonPressed,
                    submittingId && styles.disabled,
                  ]}
                >
                  {submittingId ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Connect ID</Text>
                  )}
                </Pressable>
              </View>

            </View>
          )}
        </ScrollView>
      </KeyboardAvoidView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  keyboardArea: { flex: 1 },
  page: { padding: 24, paddingBottom: 40, alignItems: 'center' },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  copy: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  statusCard: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  form: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    elevation: 4,
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  stepBlock: {
    marginBottom: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '900',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  facebookButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1877F2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 15, height: '100%' },
  submitButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 9,
    elevation: 4,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.65 },
});
