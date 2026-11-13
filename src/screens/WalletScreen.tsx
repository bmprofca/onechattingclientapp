import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import Toast from '../ui/toast';
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
  Lock,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import { checkPaymentStatus, getWalletSurcharge, PaymentStatusResponse, topupWallet } from '../api/payment';
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
  maxAttempts = 150,
  intervalMs = 2000,
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
  // Match the web app's five-minute polling window. A delayed webhook should
  // remain pending instead of being presented as a failed payment.
  return checkPaymentStatus(session, order_id);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Razorpay's Android SDK rejects with `description` holding a raw JSON
 * string (e.g. {"error":{"code":"BAD_REQUEST_ERROR","description":
 * "Payment processing cancelled by user","reason":"payment_cancelled"}}).
 * Turn any of its shapes into a short, human-readable toast.
 */
function describeRazorpayError(err: any): { title: string; message: string; cancelled: boolean } {
  let info: any = err?.error ?? err ?? {};
  const raw = err?.description ?? info?.description;
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      info = parsed?.error ?? parsed;
    } catch {
      // not JSON — fall through
    }
  } else if (typeof raw === 'string') {
    info = { ...info, description: raw };
  }

  const code = err?.code; // 0 = cancelled, 2 = network error (SDK codes)
  const reason = String(info?.reason || '').toLowerCase();
  const desc = String(info?.description || err?.message || '');
  const cancelled =
    code === 0 ||
    reason.includes('cancel') ||
    /cancel/i.test(desc) ||
    desc === 'undefined';

  if (cancelled) {
    return {
      title: 'Payment cancelled',
      message: 'No money was deducted. You can try again whenever you are ready.',
      cancelled: true,
    };
  }
  if (code === 2 || /network/i.test(desc)) {
    return {
      title: 'Connection problem',
      message: 'Please check your internet connection and try again.',
      cancelled: false,
    };
  }
  const readable =
    desc && !desc.trim().startsWith('{') && desc !== 'undefined'
      ? desc
      : 'The payment could not be completed. Please try again or use another method.';
  return { title: 'Payment failed', message: readable, cancelled: false };
}

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
  const [surchargePercent, setSurchargePercent] = useState(0);
  const [surchargeFlat, setSurchargeFlat] = useState(0);
  const [amountFocused, setAmountFocused] = useState(false);

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
    let cancelled = false;
    getWalletSurcharge(session)
      .then((config) => {
        if (cancelled) return;
        setSurchargePercent(config.percent);
        setSurchargeFlat(config.flat);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session.token, session.username]);

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
          const { title, message, cancelled } = describeRazorpayError(sdkError);
          Toast.show({
            type: cancelled ? 'info' : 'error',
            text1: title,
            text2: message,
          });
          return;
        }

        // Step 3 — SDK returned success. The server/webhook settles the order;
        // poll long enough to cover delayed webhook delivery.
        console.log('[razorpay] SDK success:', rzpData.razorpay_payment_id);
        setVerifying(true);
        const statusResult = await pollUntilSettled(session, res.order_id);
        setVerifying(false);
        setPaymentResult(statusResult);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Topup Failed',
          text2: 'This payment method is not available.',
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
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const creditAmount = Number(amount);
  const surchargeAmount = !amount || isNaN(creditAmount) || creditAmount <= 0
    ? 0
    : roundMoney(roundMoney((creditAmount * surchargePercent) / 100) + surchargeFlat);
  const payableAmount = roundMoney((Number.isFinite(creditAmount) ? creditAmount : 0) + surchargeAmount);
  const feeLabel = [
    surchargePercent > 0 ? `${surchargePercent}%` : '',
    surchargeFlat > 0 ? `₹${surchargeFlat}` : '',
  ].filter(Boolean).join(' + ');
  const rupee = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const heroBg = theme.isDark ? theme.surface : theme.primary;
  const heroText = theme.isDark ? theme.ink : theme.onPrimary;
  const formattedBalance = Number(liveBalance !== undefined ? liveBalance : (balance ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const renderHeader = (title: string, onPress?: () => void) => (
    <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
      {onPress ? (
        <ScalePressable onPress={onPress} style={[styles.backButton, { backgroundColor: theme.fieldBg }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.ink} />
        </ScalePressable>
      ) : (
        <View style={styles.headerRight} />
      )}
      <Text style={[styles.headerTitle, { color: theme.ink }]}>{title}</Text>
      <View style={styles.headerRight} />
    </View>
  );

  // ─── Verifying overlay ──────────────────────────────────────────────────────
  if (verifying) {
    return (
      <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
        {renderHeader('Verifying Payment')}
        <View style={styles.verifyingBody}>
          <FadeInView scale={true} startScale={0.9} duration={350} style={[styles.verifyingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.verifyingTile, { backgroundColor: theme.mint }]}>
              <ActivityIndicator size="large" color={theme.emerald} />
            </View>
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
          btnColor: theme.primary,
          btnText: theme.onPrimary,
        }
      : isFailed
      ? {
          Icon: XCircle,
          iconColor: theme.danger,
          bgColor: theme.dangerBg,
          label: 'Payment Failed',
          desc: 'Your payment could not be processed. Any amount deducted will be refunded within 3–5 business days.',
          btnLabel: 'Try Again',
          btnColor: theme.primary,
          btnText: theme.onPrimary,
        }
      : {
          Icon: Clock,
          iconColor: theme.warning,
          bgColor: theme.warnBg,
          label: 'Payment Pending',
          desc: 'Your payment is being verified. Your wallet will be credited once confirmed by the bank.',
          btnLabel: 'Close',
          btnColor: theme.primary,
          btnText: theme.onPrimary,
        };

    const { Icon, iconColor, bgColor, label, desc, btnLabel, btnColor, btnText } = statusConfig;

    const detailRows: { label: string; value: string; highlight?: boolean }[] = [
      { label: 'Order ID', value: paymentResult.order_id },
      ...(paymentResult.amount
        ? [{ label: Number(paymentResult.surcharge) > 0 ? 'Wallet credit' : 'Amount', value: `₹${Number(paymentResult.amount).toFixed(2)}` }]
        : []),
      ...(Number(paymentResult.surcharge) > 0
        ? [
            { label: 'Platform fee', value: `₹${Number(paymentResult.surcharge).toFixed(2)}` },
            { label: 'Amount paid', value: `₹${Number(paymentResult.payable ?? paymentResult.amount).toFixed(2)}` },
          ]
        : []),
      ...(paymentResult.payment_id
        ? [{ label: 'Payment Ref', value: paymentResult.payment_id }]
        : []),
      ...(paymentResult.utr
        ? [{ label: 'UTR / Bank Ref', value: paymentResult.utr, highlight: true }]
        : []),
    ];

    const rowVisual = (rowLabel: string) => {
      if (rowLabel === 'Order ID') return { RowIcon: Receipt, bg: theme.infoBg, fg: theme.info };
      if (rowLabel === 'Platform fee') return { RowIcon: IndianRupee, bg: theme.warnBg, fg: theme.warning };
      if (rowLabel === 'Payment Ref' || rowLabel === 'UTR / Bank Ref') return { RowIcon: BadgeCheck, bg: theme.violetBg, fg: theme.violet };
      return { RowIcon: IndianRupee, bg: theme.mint, fg: theme.mintText };
    };

    return (
      <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
        {renderHeader('Payment Receipt', handleResultClose)}

        <ScrollView
          contentContainerStyle={styles.resultPage}
          showsVerticalScrollIndicator={false}>

          {/* Status banner */}
          <FadeInView scale={true} startScale={0.92} duration={350} style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.statusTile, { backgroundColor: bgColor }]}>
              <Icon size={34} color={iconColor} strokeWidth={2} />
            </View>
            <Text style={[styles.statusLabel, { color: theme.ink }]}>{label}</Text>
            <Text style={[styles.statusDesc, { color: theme.muted }]}>{desc}</Text>
          </FadeInView>

          {/* Details list */}
          <Text style={[styles.groupHeading, { color: theme.muted }]}>Transaction details</Text>
          <FadeInView delay={120} duration={350} style={[styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {detailRows.map((row, idx) => {
              const { RowIcon, bg, fg } = rowVisual(row.label);
              return (
                <View
                  key={row.label}
                  style={[
                    styles.detailRow,
                    idx < detailRows.length - 1 && { borderBottomColor: theme.divider, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}>
                  <View style={[styles.rowTile, { backgroundColor: bg }]}>
                    <RowIcon size={16} color={fg} strokeWidth={2.25} />
                  </View>
                  <Text style={[styles.detailLabel, { color: theme.inkSoft }]}>{row.label}</Text>
                  <Text
                    selectable
                    numberOfLines={2}
                    style={[
                      styles.detailValue,
                      { color: row.highlight ? theme.emerald : theme.ink },
                      row.highlight && { fontWeight: '700' },
                    ]}>
                    {row.value}
                  </Text>
                </View>
              );
            })}
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
                <BadgeCheck size={18} color={btnText} style={{ marginRight: 8 }} />
              )}
              <Text style={[styles.buttonText, { color: btnText }]}>{btnLabel}</Text>
            </ScalePressable>
          </FadeInView>
        </ScrollView>
      </View>
    );
  }

  // ─── Main wallet screen ─────────────────────────────────────────────────────
  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {renderHeader('Wallet', onBack)}

      <KeyboardAvoidView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Balance hero */}
          <FadeInView direction="down" distance={12} duration={350}>
            <View style={[styles.heroCard, { backgroundColor: heroBg, borderColor: theme.isDark ? theme.border : heroBg }]}>
              <View pointerEvents="none" style={[styles.heroRing, styles.heroRingLarge]} />
              <View pointerEvents="none" style={[styles.heroRing, styles.heroRingSmall, { borderColor: 'rgba(43,212,125,0.25)' }]} />
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}>
                  <Wallet size={20} color={theme.accent} strokeWidth={2} />
                </View>
                <Text style={[styles.balanceLabel, { color: theme.primarySoft }]}>Available balance</Text>
              </View>
              <Text style={[styles.balanceAmount, { color: heroText }]} numberOfLines={1} adjustsFontSizeToFit>
                ₹{formattedBalance}
              </Text>
              <Text style={[styles.heroFoot, { color: theme.primarySoft }]}>Used for WhatsApp conversation charges</Text>
            </View>
          </FadeInView>

          {/* Add funds form */}
          <FadeInView delay={120} duration={400}>
            <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Add funds</Text>
              <Text style={[styles.sectionDesc, { color: theme.muted }]}>
                Select or enter an amount to recharge your wallet.
              </Text>

              {/* Quick amount presets */}
              <View style={styles.quickAmountsRow}>
                {quickAmounts.map(preset => {
                  const selected = amount === preset;
                  return (
                    <ScalePressable
                      key={preset}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setAmount(preset)}
                      style={[
                        styles.quickAmountBtn,
                        { backgroundColor: theme.surface, borderColor: theme.fieldBorder, borderWidth: 1 },
                        selected && { borderColor: theme.emerald, backgroundColor: theme.mint, borderWidth: 2 },
                      ]}>
                      <Text
                        style={[
                          styles.quickAmountText,
                          { color: selected ? theme.mintText : theme.ink },
                        ]}>
                        ₹{Number(preset).toLocaleString('en-IN')}
                      </Text>
                    </ScalePressable>
                  );
                })}
              </View>

              {/* Custom amount input */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.inkSoft }]}>Custom amount</Text>
                <View
                  style={[
                    styles.inputRow,
                    {
                      backgroundColor: theme.fieldBg,
                      borderColor: amountFocused ? theme.primary : theme.fieldBorder,
                      borderWidth: amountFocused ? 1.5 : 1,
                    },
                  ]}>
                  <Text style={[styles.rupeePrefix, { color: theme.inkSoft }]}>₹</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor={theme.placeholder}
                    style={[styles.input, { color: theme.ink }]}
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                  />
                </View>
              </View>

              {surchargeAmount > 0 && (
                <View style={[styles.feeBox, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <View style={styles.feeRow}>
                    <Text style={[styles.feeLabel, { color: theme.muted }]}>Wallet credit</Text>
                    <Text style={[styles.feeValue, { color: theme.ink }]}>{rupee(creditAmount)}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={[styles.feeLabel, { color: theme.muted }]}>Platform fee{feeLabel ? ` (${feeLabel})` : ''}</Text>
                    <Text style={[styles.feeValue, { color: theme.ink }]}>{rupee(surchargeAmount)}</Text>
                  </View>
                  <View style={[styles.feeDivider, { backgroundColor: theme.divider }]} />
                  <View style={styles.feeRow}>
                    <Text style={[styles.feeLabel, styles.feeTotal, { color: theme.ink }]}>You pay</Text>
                    <Text style={[styles.feeValue, styles.feeTotal, { color: theme.ink }]}>{rupee(payableAmount)}</Text>
                  </View>
                </View>
              )}

              {/* Pay button */}
              <ScalePressable
                accessibilityRole="button"
                disabled={loading}
                onPress={handleTopup}
                style={[
                  styles.button,
                  { backgroundColor: theme.primary },
                  loading && styles.disabled,
                ]}>
                {loading ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <>
                    <Lock size={17} color={theme.onPrimary} strokeWidth={2.25} style={{ marginRight: 8 }} />
                    <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
                      {surchargeAmount > 0 ? `Pay securely · ${rupee(payableAmount)}` : 'Pay securely'}
                    </Text>
                  </>
                )}
              </ScalePressable>
              <Text style={[styles.secureNote, { color: theme.muted }]}>Payments processed by Razorpay</Text>
            </View>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidView>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerRight: { width: 38 },

  // Main wallet page
  page: { padding: 16, paddingBottom: 48 },

  heroCard: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  heroRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroRingLarge: { width: 240, height: 240, borderRadius: 120, top: -110, right: -80 },
  heroRingSmall: { width: 130, height: 130, borderRadius: 65, bottom: -60, right: 40 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43,212,125,0.14)',
  },
  balanceLabel: { fontSize: 13, fontWeight: '600' },
  balanceAmount: { fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 18 },
  heroFoot: { fontSize: 12, marginTop: 6 },

  form: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionDesc: { fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 19 },

  quickAmountsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  quickAmountBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAmountText: { fontSize: 14, fontWeight: '700' },

  field: { marginBottom: 16 },
  feeBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, gap: 10 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  feeLabel: { fontSize: 13, flex: 1 },
  feeValue: { fontSize: 13, fontWeight: '600' },
  feeTotal: { fontSize: 15, fontWeight: '800' },
  feeDivider: { height: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  rupeePrefix: { fontSize: 17, fontWeight: '700' },
  input: { flex: 1, fontSize: 16, height: '100%', fontWeight: '600' },

  button: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  secureNote: { fontSize: 12, textAlign: 'center', marginTop: 10 },

  // Verifying overlay
  verifyingBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  verifyingCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  verifyingTile: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  verifyingTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  verifyingDesc: { fontSize: 14, textAlign: 'center', lineHeight: 21 },

  // Result page
  resultPage: { padding: 16, paddingBottom: 48 },

  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  statusTile: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: { fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  statusDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 21 },

  groupHeading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },

  detailCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 20,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: 10,
    gap: 12,
  },
  rowTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: '50%',
    textAlign: 'right',
  },
});
