import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Wallet, IndianRupee, ArrowLeft } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { topupWallet } from '../api/payment';
import { useTheme } from '../theme/theme';

export function WalletScreen({
  session,
  balance,
  onBack,
}: {
  session: ApiSession;
  balance: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const handleTopup = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Please enter a valid amount to top-up.' });
      return;
    }

    setLoading(true);
    try {
      const res = await topupWallet(session, amount);
      if (res.error) {
        throw new Error(res.msg || 'Topup initiation failed.');
      }
      
      // In a real app, this would redirect to Razorpay/Cashfree SDK.
      // Since SDKs are not integrated, we will mock success or just display the token.
      Toast.show({ 
        type: 'success', 
        text1: 'Order Created', 
        text2: `Order created successfully for ${res.gateway}. Complete payment on the web interface.`
      });
      setAmount('');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Topup Failed',
        text2: error instanceof Error ? error.message : 'Unable to initiate topup.',
      });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['500', '1000', '2000', '5000'];

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <ArrowLeft size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Wallet</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.walletIcon, { backgroundColor: theme.mint }]}>
              <Wallet size={32} color={theme.emerald} strokeWidth={2} />
            </View>
            <Text style={[styles.balanceLabel, { color: theme.muted }]}>AVAILABLE BALANCE</Text>
            <Text style={[styles.balanceAmount, { color: theme.ink }]}>₹{balance}</Text>
          </View>

          <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Add Funds</Text>
            <Text style={[styles.sectionDesc, { color: theme.muted }]}>Select or enter amount to recharge your wallet.</Text>
            
            <View style={styles.quickAmountsRow}>
              {quickAmounts.map(preset => (
                <Pressable
                  key={preset}
                  onPress={() => setAmount(preset)}
                  style={[
                    styles.quickAmountBtn,
                    { backgroundColor: theme.canvas, borderColor: theme.border },
                    amount === preset && { borderColor: theme.emerald, backgroundColor: theme.mint }
                  ]}
                >
                  <Text style={[
                    styles.quickAmountText, 
                    { color: theme.ink },
                    amount === preset && { color: theme.emerald, fontWeight: '700' }
                  ]}>₹{preset}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.muted }]}>CUSTOM AMOUNT</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
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

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={handleTopup}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.emerald, shadowColor: theme.emeraldDark },
                pressed && !loading && styles.buttonPressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Proceed to Pay</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  page: { padding: 20, paddingBottom: 40 },
  heroCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 24,
    marginTop: 10,
  },
  walletIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  form: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 4,
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 20,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickAmountBtn: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 15,
    fontWeight: '600',
  },
  field: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 },
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
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 9,
    elevation: 4,
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.65 },
});
