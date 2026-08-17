import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import RazorpayCheckout from 'react-native-razorpay';
import {
  Wallet,
  IndianRupee,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  BadgeCheck,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import { checkPaymentStatus, PaymentStatusResponse, topupWallet } from '../api/payment';
import { useTheme } from '../theme/theme';
import { ScalePressable, FadeInView } from '../components/animations';

// ─── Polling Helper ───────────────────────────────────────────────────────────

/**
 * Polls /payment/payment-status until status is SUCCESS or FAILED,
 * or until maxAttempts is exhausted (returns last PENDING result).
 * The webhook from Razorpay typically fires within 2–5 seconds of SDK success.
 */
async function pollUntilSettled(
  session: ApiSession,
  order_id: string,
  maxAttempts = 10,
  intervalMs = 2500,
): Promise<PaymentStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), intervalMs));
    }
    const result = await checkPaymentStatus(session, order_id);
    if (result.status === 'SUCCESS' || result.status === 'FAILED') {
      return result;
    }
  }
  // Exhausted retries — return last known state (likely still PENDING)
  return checkPaymentStatus(session, order_id);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WalletScreen({
  session,
  balance,
  onBack,
  onBalanceUpdated,
}: {
  session: ApiSession;
  balance?: string | number;
  onBack: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}) {
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [liveBalance, setLiveBalance] = useState<string | number | undefined>(balance);
  const [paymentResult, setPaymentResult] = useState<PaymentStatusResponse | null>(null);

  const balanceUpdatedRef = React.useRef(onBalanceUpdated);
  balanceUpdatedRef.current = onBalanceUpdated;

  const fetchLatestBalance = useCallback(async () => {
    try {
      const profile = await getAccountProfile(session);
      if (profile.balance !== undefined) {
        setLiveBalance(profile.balance);
        balanceUpdatedRef.current?.(profile.balance);
      }
    } catch {
      // ignore
    }
  }, [session.token, session.username]);

  useEffect(() => {
    fetchLatestBalance();
  }, [fetchLatestBalance]);

  useEffect(() => {
    if (balance !== undefined) {
      setLiveBalance(balance);
    }
  }, [balance]);

  // Hardware back button
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (paymentResult) {
        handleResultClose();
        return true;
      }
      if (verifying) return true; // block back during verification
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack, paymentResult, verifying]);

  const handleResultClose = useCallback(() => {
    const wasSuccess = paymentResult?.status === 'SUCCESS';
    setPaymentResult(null);
    setAmount('');
    if (wasSuccess) {
      fetchLatestBalance();
      onBack(); // navigate back so parent can refresh balance
    }
  }, [paymentResult, onBack, fetchLatestBalance]);

  // ─── Main top-up handler ────────────────────────────────────────────────────
  const handleTopup = async () => {
    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Please enter a valid amount to top-up.',
      });
      return;
    }

    setLoading(true);

    try {
      // Step 1 — Create payment order on server
      const res = await topupWallet(session, amount);
      setLoading(false);

      if (res.gateway === 'razorpay') {
        // Step 2 — Open Razorpay payment sheet
        let rzpData;
        try {
          rzpData = await RazorpayCheckout.open({
            key: res.key_id!,
            amount: res.amount,           // already in paise from server (₹2000 = 200000)
            currency: res.currency || 'INR',
            order_id: res.token_id,       // Razorpay's own order ID
            name: 'OneChatting',
            description: 'Wallet Top-up',
            theme: { color: theme.emerald },
          });
        } catch (sdkError: any) {
          // User cancelled or card was declined inside the SDK
          const desc =
            sdkError?.description ||
            sdkError?.error?.description ||
            sdkError?.message ||
            'Payment was cancelled or failed.';
          Toast.show({
            type: 'error',
            text1: 'Payment Not Completed',
            text2: desc,
          });
          return;
        }

        // Step 3 — SDK returned success; poll server to confirm wallet credit
        console.log('[razorpay] SDK success:', rzpData.razorpay_payment_id);
        setVerifying(true);
        const statusResult = await pollUntilSettled(session, res.order_id);
        setVerifying(false);
        setPaymentResult(statusResult);

      } else {
        // Cashfree / Zwitch — SDK not installed, show informational toast
        Toast.show({
          type: 'info',
          text1: 'Order Created',
          text2: `Order #${res.order_id} created. Complete payment on the web interface.`,
          visibilityTime: 5000,
        });
      }
    } catch (error: any) {
      setLoading(false);
      setVerifying(false);
      Toast.show({
        type: 'error',
        text1: 'Topup Failed',
        text2:
          error instanceof Error
            ? error.message
            : 'Unable to initiate topup. Please try again.',
      });
    }
  };

  const quickAmounts = ['500', '1000', '2000', '5000'];

  // ─── Verifying overlay ──────────────────────────────────────────────────────
  if (verifying) {
    return (
      <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <View style={styles.backButton} />
          <Text style={[styles.headerTitle, { color: theme.ink }]}>Verifying Payment</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.verifyingBody}>
          <FadeInView scale={true} startScale={0.9} duration={350} style={[styles.verifyingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator size="large" color={theme.emerald} style={{ marginBottom: 24 }} />
            <Text style={[styles.verifyingTitle, { color: theme.ink }]}>Confirming with bank…</Text>
            <Text style={[styles.verifyingDesc, { color: theme.muted }]}>
              Please wait while we verify your payment. This usually takes a few seconds.
            </Text>
          </FadeInView>
        </View>
      </View>
    );
  }

  // ─── Payment result card ────────────────────────────────────────────────────
  if (paymentResult) {
    const isSuccess = paymentResult.status === 'SUCCESS';
    const isFailed = paymentResult.status === 'FAILED';

    const statusConfig = isSuccess
      ? {
          Icon: CheckCircle2,
          iconColor: theme.emerald,
          bgColor: theme.mint,
          label: 'Payment Successful',
          desc: 'Your wallet has been credited successfully.',
          btnLabel: 'Done — View Balance',
          btnColor: theme.emerald,
        }
      : isFailed
      ? {
          Icon: XCircle,
          iconColor: theme.danger,
          bgColor: theme.isDark ? '#3B1010' : '#FEF2F2',
          label: 'Payment Failed',
          desc: 'Your payment could not be processed. Any amount deducted will be refunded within 3–5 business days.',
          btnLabel: 'Try Again',
          btnColor: theme.danger,
        }
      : {
          Icon: Clock,
          iconColor: theme.warning,
          bgColor: theme.isDark ? '#3B2800' : '#FFFBEB',
          label: 'Payment Pending',
          desc: 'Your payment is being verified. Your wallet will be credited once confirmed by the bank.',
          btnLabel: 'Close',
          btnColor: theme.muted,
        };

    const { Icon, iconColor, bgColor, label, desc, btnLabel, btnColor } = statusConfig;

    const detailRows: { label: string; value: string; highlight?: boolean }[] = [
      { label: 'Order ID', value: paymentResult.order_id },
      ...(paymentResult.amount
        ? [{ label: 'Amount', value: `₹${Number(paymentResult.amount).toFixed(2)}` }]
        : []),
      ...(paymentResult.payment_id
        ? [{ label: 'Payment Ref', value: paymentResult.payment_id }]
        : []),
      ...(paymentResult.utr
        ? [{ label: 'UTR / Bank Ref', value: paymentResult.utr, highlight: true }]
        : []),
    ];

    return (
      <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <ScalePressable onPress={handleResultClose} style={styles.backButton} hitSlop={8}>
            <ArrowLeft size={24} color={theme.ink} />
          </ScalePressable>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>Payment Receipt</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          contentContainerStyle={styles.resultPage}
          showsVerticalScrollIndicator={false}>

          {/* Status banner */}
          <FadeInView scale={true} startScale={0.92} duration={350} style={[styles.statusBadge, { backgroundColor: bgColor }]}>
            <Icon size={48} color={iconColor} strokeWidth={1.75} />
            <Text style={[styles.statusLabel, { color: iconColor }]}>{label}</Text>
            <Text style={[styles.statusDesc, { color: theme.muted }]}>{desc}</Text>
          </FadeInView>

          {/* Details list */}
          <FadeInView delay={120} duration={350} style={[styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {detailRows.map((row, idx) => (
              <View
                key={row.label}
                style={[
                  styles.detailRow,
                  idx < detailRows.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}>
                <Text style={[styles.detailLabel, { color: theme.muted }]}>{row.label}</Text>
                <Text
                  selectable
                  style={[
                    styles.detailValue,
                    { color: row.highlight ? theme.emerald : theme.ink },
                    row.highlight && { fontWeight: '700' },
                  ]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </FadeInView>

          {/* CTA button */}
          <FadeInView delay={220} duration={350}>
            <ScalePressable
              onPress={handleResultClose}
              style={[
                styles.button,
                { backgroundColor: btnColor },
              ]}>
              {isSuccess && (
                <BadgeCheck size={18} color="#FFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.buttonText}>{btnLabel}</Text>
            </ScalePressable>
          </FadeInView>
        </ScrollView>
      </View>
    );
  }

  // ─── Main wallet screen ─────────────────────────────────────────────────────
  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <ScalePressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </ScalePressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Wallet</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Balance hero */}
          <FadeInView direction="down" distance={12} duration={350}>
            <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.walletIconWrap, { backgroundColor: theme.mint }]}>
                <Wallet size={32} color={theme.emerald} strokeWidth={2} />
              </View>
              <Text style={[styles.balanceLabel, { color: theme.muted }]}>AVAILABLE BALANCE</Text>
              <Text style={[styles.balanceAmount, { color: theme.ink }]}>
                ₹{Number(liveBalance !== undefined ? liveBalance : (balance ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          </FadeInView>

          {/* Add funds form */}
          <FadeInView delay={120} duration={400} scale={true} startScale={0.96}>
            <View
              style={[
                styles.form,
                { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Add Funds</Text>
              <Text style={[styles.sectionDesc, { color: theme.muted }]}>
                Select or enter an amount to recharge your wallet.
              </Text>

              {/* Quick amount presets */}
              <View style={styles.quickAmountsRow}>
                {quickAmounts.map(preset => (
                  <ScalePressable
                    key={preset}
                    onPress={() => setAmount(preset)}
                    style={[
                      styles.quickAmountBtn,
                      { backgroundColor: theme.canvas, borderColor: theme.border },
                      amount === preset && { borderColor: theme.emerald, backgroundColor: theme.mint },
                    ]}>
                    <Text
                      style={[
                        styles.quickAmountText,
                        { color: theme.ink },
                        amount === preset && { color: theme.emerald, fontWeight: '700' },
                      ]}>
                      ₹{preset}
                    </Text>
                  </ScalePressable>
                ))}
              </View>

              {/* Custom amount input */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>CUSTOM AMOUNT</Text>
                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: theme.canvas, borderColor: theme.border },
                  ]}>
                  <IndianRupee size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { color: theme.ink }]}
                  />
                </View>
              </View>

              {/* Pay button */}
              <ScalePressable
                accessibilityRole="button"
                disabled={loading}
                onPress={handleTopup}
                style={[
                  styles.button,
                  { backgroundColor: theme.emerald },
                  loading && styles.disabled,
                ]}>
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Proceed to Pay</Text>
                )}
              </ScalePressable>
            </View>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  // Header
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

  // Main wallet page
  page: { padding: 20, paddingBottom: 48 },

  heroCard: {
    padding: 28,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 20,
    marginTop: 8,
  },
  walletIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  balanceAmount: { fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },

  form: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 4,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sectionDesc: { fontSize: 13, marginBottom: 20, lineHeight: 19 },

  quickAmountsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  quickAmountBtn: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  quickAmountText: { fontSize: 15, fontWeight: '600' },

  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: { flex: 1, fontSize: 16, height: '100%', fontWeight: '600' },

  button: {
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },

  // Verifying overlay
  verifyingBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  verifyingCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 40,
    alignItems: 'center',
  },
  verifyingTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  verifyingDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Result page
  resultPage: { padding: 20, paddingBottom: 48 },

  statusBadge: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  statusLabel: { fontSize: 22, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  statusDesc: { fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 21 },

  amountCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  receiptIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  amountLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  amountValue: { fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },

  detailCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
