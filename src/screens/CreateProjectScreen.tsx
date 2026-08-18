import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import Toast from 'react-native-toast-message';
import {
  Briefcase,
  FolderPlus,
  CreditCard,
  DollarSign,
  ArrowLeft,
} from 'lucide-react-native';
import { ApiError, ApiSession } from '../api/client';
import { createProject, getPlans, PlanPackages } from '../api/workspace';
import { useTheme } from '../theme/theme';
import { ScalePressable, FadeInView, FadeScaleModal } from '../components/animations';

export function CreateProjectScreen({
  session,
  onBack,
  onCreated,
  onRechargeWallet,
}: {
  session: ApiSession;
  onBack: () => void;
  onCreated: (newProject: { id: string; name: string }) => void;
  onRechargeWallet?: () => void;
}) {
  const theme = useTheme();
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);

  const [plans, setPlans] = useState<PlanPackages | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientAmount, setInsufficientAmount] = useState('0');

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getPlans(session);
        const pkg = res?.data?.package as PlanPackages | undefined;
        if (mounted && pkg?.monthly && pkg?.yearly) {
          setPlans(pkg);
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Unable to load packages',
          text2: error instanceof Error ? error.message : 'Please try again.',
        });
      } finally {
        if (mounted) setPlansLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session]);

  const selectedPlan = plans ? plans[billingCycle] : null;

  const formatAmount = (value: string) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return `₹${value}`;
    return `₹${num % 1 === 0 ? num.toLocaleString('en-IN') : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCreate = async () => {
    if (!companyName.trim()) {
      Toast.show({ type: 'error', text1: 'Company Name Required', text2: 'Please enter a company name.' });
      return;
    }
    if (!projectName.trim()) {
      Toast.show({ type: 'error', text1: 'Project Name Required', text2: 'Please enter a project name.' });
      return;
    }
    if (!selectedPlan) {
      Toast.show({ type: 'error', text1: 'Package Not Ready', text2: 'Please wait for packages to load.' });
      return;
    }

    setLoading(true);
    try {
      const res = await createProject(session, companyName.trim(), projectName.trim(), selectedPlan.package_id);
      Toast.show({ type: 'success', text1: 'Project Created', text2: 'Your new workspace is ready.' });
      if (res.data?.project_id) {
        onCreated({ id: String(res.data.project_id), name: res.data.name });
      } else {
        onCreated({ id: '', name: projectName.trim() });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/insufficient balance/i.test(message)) {
        setInsufficientAmount(selectedPlan.amount);
        setShowInsufficientModal(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Creation Failed',
          text2: message || 'Unable to create project.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.canvas,
    borderColor: theme.border,
  };

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.canvas, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.bubbleInText }]}>New Project</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidView style={styles.keyboardArea}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <View style={[styles.heroIcon, { backgroundColor: theme.mint }]}>
              <FolderPlus size={32} color={theme.emerald} strokeWidth={2} />
            </View>

            <Text style={[styles.title, { color: theme.ink }]}>Create a workspace</Text>
            <Text style={[styles.copy, { color: theme.muted }]}>Set up a new WhatsApp Business account for your company.</Text>

            <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>COMPANY NAME</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Briefcase size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    autoCapitalize="words"
                    placeholder="Acme Corp"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>PROJECT NAME</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <FolderPlus size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={projectName}
                    onChangeText={setProjectName}
                    autoCapitalize="words"
                    placeholder="Main Workspace"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.muted }]}>PACKAGE</Text>

                {plansLoading ? (
                  <View style={styles.packageLoading}>
                    <ActivityIndicator color={theme.emerald} />
                  </View>
                ) : plans ? (
                  <>
                    <View style={[styles.segmentWrap, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                    <Pressable
                        onPress={() => setBillingCycle('monthly')}
                        style={[
                          styles.segment,
                          billingCycle === 'monthly' && {
                            backgroundColor: theme.surface,
                            borderColor: theme.emerald,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: billingCycle === 'monthly' ? theme.emerald : theme.muted },
                          ]}
                        >
                          Monthly — {formatAmount(plans.monthly.amount)}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setBillingCycle('yearly')}
                        style={[
                          styles.segment,
                          billingCycle === 'yearly' && {
                            backgroundColor: theme.surface,
                            borderColor: theme.emerald,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: billingCycle === 'yearly' ? theme.emerald : theme.muted },
                          ]}
                        >
                          Yearly — {formatAmount(plans.yearly.amount)}
                        </Text>
                    </Pressable>
                    </View>
                    <Text style={[styles.segmentCaption, { color: theme.muted }]}>
                      Billed per {billingCycle === 'monthly' ? 'month' : 'year'} per project.
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.copy, { color: theme.muted, marginTop: 0, marginBottom: 0 }]}>
                    Unable to load packages. Pull to retry.
                  </Text>
                )}
              </View>

              <ScalePressable
                accessibilityRole="button"
                disabled={loading || plansLoading || !plans}
                onPress={handleCreate}
                style={[
                  styles.button,
                  { backgroundColor: theme.emerald, shadowColor: theme.emeraldDark },
                  (loading || plansLoading || !plans) && styles.disabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Create Project</Text>
                )}
              </ScalePressable>

            </View>
        </ScrollView>
      </KeyboardAvoidView>

      <FadeScaleModal
        visible={showInsufficientModal}
        onClose={() => setShowInsufficientModal(false)}
      >
        <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
          <View style={styles.modalIconCircle}>
            <DollarSign size={28} color="#D97706" strokeWidth={2.25} />
          </View>
          <Text style={[styles.modalTitle, { color: theme.ink }]}>Insufficient wallet balance</Text>
          <Text style={[styles.modalDesc, { color: theme.muted }]}>
            Your wallet balance is not enough to complete this action. Please recharge your wallet to continue.
          </Text>
          <Text style={styles.modalAmount}>Amount due: {formatAmount(insufficientAmount)}</Text>
          <View style={styles.modalActions}>
            <ScalePressable
              onPress={() => setShowInsufficientModal(false)}
              style={[styles.modalButton, styles.modalCancelButton]}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </ScalePressable>
            <ScalePressable
              onPress={() => {
                setShowInsufficientModal(false);
                if (onRechargeWallet) {
                  onRechargeWallet();
                } else {
                  Toast.show({ type: 'info', text1: 'Wallet recharge coming soon' });
                }
              }}
              style={[styles.modalButton, styles.modalRechargeButton]}
            >
              <CreditCard size={16} color="#FFF" strokeWidth={2.25} />
              <Text style={styles.modalRechargeText}>Recharge wallet</Text>
            </ScalePressable>
          </View>
        </View>
      </FadeScaleModal>
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
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  copy: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  form: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    elevation: 4,
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  field: { marginTop: 14 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, height: '100%' },

  packageLoading: { height: 52, alignItems: 'center', justifyContent: 'center' },
  segmentWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 13,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: { fontSize: 13, fontWeight: '700' },
  segmentCaption: { fontSize: 11, marginTop: 8, textAlign: 'center' },

  button: {
    height: 54,
    marginTop: 24,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 9,
    elevation: 4,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.65 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  modalAmount: { fontSize: 16, fontWeight: '800', color: '#4F46E5', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalCancelButton: { backgroundColor: '#F3F4F6' },
  modalCancelText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  modalRechargeButton: { backgroundColor: '#4F46E5' },
  modalRechargeText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});