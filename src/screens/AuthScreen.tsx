import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { KeyboardAvoidView } from '../components/KeyboardAvoidView';
import Toast from '../ui/toast';
import { SearchClearButton } from '../components/SearchClearButton';
import { ArrowRight, Briefcase, ChevronDown, Globe, Lock, Mail, Phone, User, KeyRound, X } from 'lucide-react-native';
import { login, register, sendOtp } from '../api/auth';
import { saveSession, Session } from '../services/session';
import { useTheme } from '../theme/theme';
import { countryCodes } from '../utils/countryCodes';

import { ScalePressable, FadeInView, SlideUpModal } from '../components/animations';

const logo = require('../assets/logo.png');

type AuthMode = 'login' | 'signup';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firmName, setFirmName] = useState('');
  const [mobile, setMobile] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep(1);
    setOtp('');
  };

  const submit = async () => {
    if (step === 1) {
      if (!mobile.trim() || !countryCode.trim()) {
        Toast.show({ type: 'error', text1: 'Mobile required', text2: 'Enter your country code and mobile number.' });
        return;
      }
      if (mode === 'signup') {
        if (!name.trim()) {
          Toast.show({ type: 'error', text1: 'Name required', text2: 'Enter your name to create an account.' });
          return;
        }
        if (!email.trim()) {
          Toast.show({ type: 'error', text1: 'Email required', text2: 'Enter your work email.' });
          return;
        }
        if (!firmName.trim()) {
          Toast.show({ type: 'error', text1: 'Company name required', text2: 'Enter your company or business name.' });
          return;
        }
      }

      setLoading(true);
      try {
        // ✅ FIX: Send purpose based on mode
        const purpose = mode === 'login' ? 'login' : 'signup';
        await sendOtp(mobile.trim(), purpose);
        setStep(2);
        Toast.show({ type: 'success', text1: 'OTP Sent', text2: 'Please check your mobile for the OTP.' });
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Request failed', text2: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setLoading(false);
      }
    } else {
      if (!otp.trim()) {
        Toast.show({ type: 'error', text1: 'OTP required', text2: 'Please enter the OTP sent to your mobile.' });
        return;
      }

      setLoading(true);
      try {
        if (mode === 'login') {
          const result = await login(mobile.trim(), otp.trim());
          const session: Session = { ...result, projects: result.projects || [] };
          await saveSession(session);
          Toast.show({ type: 'success', text1: 'Signed in successfully' });
          onAuthenticated(session);
        } else if (mode === 'signup') {
          const result = await register({
            name: name.trim(),
            email: email.trim(),
            firm_name: firmName.trim(),
            mobile: mobile.trim(),
            country_code: countryCode.trim(),
            otp: otp.trim(),
          });
          const session: Session = { ...result, projects: result.projects || [] };
          await saveSession(session);
          Toast.show({ type: 'success', text1: 'Account created', text2: 'Welcome to OneChatting!' });
          onAuthenticated(session);
        }
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Request failed', text2: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setLoading(false);
      }
    }
  };

  const content = mode === 'login'
    ? { eyebrow: 'WELCOME BACK', title: 'Your workspace,\nready when you are.', copy: 'Sign in to keep customer conversations moving.', action: step === 1 ? 'Send OTP' : 'Sign in' }
    : { eyebrow: 'CREATE ACCOUNT', title: 'Start something\nmeaningful.', copy: 'Create your secure OneChatting workspace.', action: step === 1 ? 'Send OTP' : 'Create account' };

  const fieldStyle = (key: string) => ({
    backgroundColor: theme.fieldBg,
    borderColor: focusedField === key ? theme.primary : theme.fieldBorder,
    borderWidth: focusedField === key ? 1.5 : 1,
  });
  const focusProps = (key: string) => ({
    onFocus: () => setFocusedField(key),
    onBlur: () => setFocusedField(current => (current === key ? null : current)),
  });
  const filteredCountryCodes = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return countryCodes;
    return countryCodes.filter(country =>
      country.name.toLowerCase().includes(query) || country.dialCode.includes(query) || country.code.toLowerCase().includes(query),
    );
  }, [countrySearch]);

  const chooseCountry = (dialCode: string) => {
    setCountryCode(dialCode);
    setCountryPickerOpen(false);
    setCountrySearch('');
  };

  return (
    <View style={[styles.safe, { backgroundColor: HERO_NAVY }]}>
      <KeyboardAvoidView style={styles.keyboardArea}>
        <ScrollView
          style={{ backgroundColor: theme.surface }}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Navy hero */}
          <View style={[styles.hero, { minHeight: Math.round(windowHeight * 0.45) }]}>
            <View pointerEvents="none" style={[styles.ring, styles.ringLarge]} />
            <View pointerEvents="none" style={[styles.ring, styles.ringMedium]} />
            <View pointerEvents="none" style={[styles.ring, styles.ringSmall, { borderColor: 'rgba(43,212,125,0.22)' }]} />

            <FadeInView direction="down" distance={15} duration={400}>
              <Image source={logo} style={styles.heroLogo} accessibilityLabel="OneChatting logo" />
            </FadeInView>

            <FadeInView delay={100} duration={450}>
              <Text style={styles.heroTitle}>Every customer conversation, in one inbox.</Text>
              <Text style={[styles.heroCopy, { color: HERO_SOFT }]}>WhatsApp chats, cases and campaigns for your whole team.</Text>
            </FadeInView>
          </View>

          {/* White sheet */}
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <FadeInView delay={150} duration={400}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>{content.title.replace('\n', ' ')}</Text>
              <Text style={[styles.sheetCopy, { color: theme.muted }]}>{content.copy}</Text>
            </FadeInView>

            {/* Segmented mode switcher */}
            <FadeInView delay={180} duration={400}>
              <View style={[styles.segment, { backgroundColor: theme.fieldBg, borderColor: theme.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === 'login' }}
                  onPress={() => switchMode('login')}
                  style={[styles.segmentItem, mode === 'login' && { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                >
                  <Text style={[styles.segmentText, { color: mode === 'login' ? theme.ink : theme.muted }]}>Sign in</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === 'signup' }}
                  onPress={() => switchMode('signup')}
                  style={[styles.segmentItem, mode === 'signup' && { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                >
                  <Text style={[styles.segmentText, { color: mode === 'signup' ? theme.ink : theme.muted }]}>Create account</Text>
                </Pressable>
              </View>
            </FadeInView>

            <FadeInView delay={230} duration={450}>
              <View style={styles.form}>
                {mode === 'signup' && step === 1 && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: theme.inkSoft }]}>Full name</Text>
                    <View style={[styles.inputRow, fieldStyle('name')]}>
                      <User size={18} color={theme.muted} strokeWidth={2} />
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        placeholder="Your name"
                        placeholderTextColor={theme.placeholder}
                        style={[styles.input, { color: theme.ink }]}
                        {...focusProps('name')}
                      />
                    </View>
                  </View>
                )}

                {mode === 'signup' && step === 1 && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: theme.inkSoft }]}>Work email</Text>
                    <View style={[styles.inputRow, fieldStyle('email')]}>
                      <Mail size={18} color={theme.muted} strokeWidth={2} />
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder="you@company.com"
                        placeholderTextColor={theme.placeholder}
                        style={[styles.input, { color: theme.ink }]}
                        {...focusProps('email')}
                      />
                    </View>
                  </View>
                )}

                {mode === 'signup' && step === 1 && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: theme.inkSoft }]}>Company / business name</Text>
                    <View style={[styles.inputRow, fieldStyle('firm')]}>
                      <Briefcase size={18} color={theme.muted} strokeWidth={2} />
                      <TextInput
                        value={firmName}
                        onChangeText={setFirmName}
                        autoCapitalize="words"
                        placeholder="Your company name"
                        placeholderTextColor={theme.placeholder}
                        style={[styles.input, { color: theme.ink }]}
                        {...focusProps('firm')}
                      />
                    </View>
                  </View>
                )}

                {step === 1 && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: theme.inkSoft }]}>Mobile number</Text>
                    <View style={styles.phoneRow}>
                      <ScalePressable
                        accessibilityRole="button"
                        accessibilityLabel="Select country code"
                        onPress={() => setCountryPickerOpen(true)}
                        style={[styles.countryCodePicker, { backgroundColor: theme.fieldBg, borderColor: theme.fieldBorder }]}
                      >
                        <Globe size={15} color={theme.muted} strokeWidth={2} />
                        <Text style={[styles.countryCodeText, { color: theme.ink }]}>{countryCode}</Text>
                        <ChevronDown size={14} color={theme.muted} />
                      </ScalePressable>
                      <View style={[styles.inputRow, styles.phoneInput, fieldStyle('mobile')]}>
                        <Phone size={18} color={theme.muted} strokeWidth={2} />
                        <TextInput
                          value={mobile}
                          onChangeText={setMobile}
                          keyboardType="phone-pad"
                          placeholder="Mobile number"
                          placeholderTextColor={theme.placeholder}
                          style={[styles.input, { color: theme.ink }]}
                          {...focusProps('mobile')}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {step === 2 && (
                  <FadeInView distance={10} duration={300} style={styles.field}>
                    <Text style={[styles.label, { color: theme.inkSoft }]}>Enter OTP</Text>
                    <Text style={[styles.otpHint, { color: theme.muted }]}>Sent to {countryCode} {mobile}</Text>
                    <View style={[styles.inputRow, fieldStyle('otp')]}>
                      <KeyRound size={18} color={theme.muted} strokeWidth={2} />
                      <TextInput
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        placeholder="Enter the 6-digit OTP"
                        placeholderTextColor={theme.placeholder}
                        style={[styles.input, styles.otpInput, { color: theme.ink }]}
                        maxLength={6}
                        {...focusProps('otp')}
                      />
                    </View>
                  </FadeInView>
                )}

                <ScalePressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={submit}
                  style={[
                    styles.button,
                    { backgroundColor: theme.primary },
                    loading && styles.disabled,
                  ]}
                >
                  {loading
                    ? <ActivityIndicator color={theme.onPrimary} />
                    : (
                      <View style={styles.buttonInner}>
                        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{content.action}</Text>
                        <ArrowRight size={18} color={theme.onPrimary} strokeWidth={2.25} />
                      </View>
                    )}
                </ScalePressable>

                {step === 2 && (
                  <ScalePressable onPress={() => setStep(1)} style={styles.forgotLink}>
                    <Text style={[styles.link, { color: theme.emerald }]}>← Back</Text>
                  </ScalePressable>
                )}
              </View>
            </FadeInView>

            <View style={styles.footer}>
              <Lock size={13} color={theme.muted} strokeWidth={2.25} />
              <Text style={[styles.terms, { color: theme.muted }]}>Encrypted sign-in</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidView>

      <SlideUpModal
        visible={countryPickerOpen}
        onClose={() => setCountryPickerOpen(false)}
        maxHeight="82%"
      >
        <KeyboardAvoidView style={{ flex: 0 }}>
          <View style={[styles.countryModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.ink }]}>Select country or region</Text>
                <Text style={[styles.modalSubtitle, { color: theme.muted }]}>Choose the phone country code</Text>
              </View>
              <ScalePressable accessibilityRole="button" accessibilityLabel="Close country selector" onPress={() => setCountryPickerOpen(false)} style={styles.closeButton}>
                <X size={22} color={theme.ink} />
              </ScalePressable>
            </View>
            <View style={[styles.searchRow, { backgroundColor: theme.fieldBg, borderColor: theme.fieldBorder }]}>
              <Globe size={17} color={theme.muted} />
              <TextInput autoFocus value={countrySearch} onChangeText={setCountrySearch} placeholder="Search country or code" placeholderTextColor={theme.placeholder} style={[styles.searchInput, { color: theme.ink }]} />
              <SearchClearButton value={countrySearch} onClear={() => setCountrySearch('')} color={theme.muted} />
            </View>
            <FlatList
              data={filteredCountryCodes}
              keyExtractor={country => country.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <FadeInView delay={Math.min(index * 25, 200)} distance={8}>
                  <ScalePressable onPress={() => chooseCountry(item.dialCode)} style={[styles.countryOption, { borderBottomColor: theme.divider }, item.dialCode === countryCode && { backgroundColor: theme.mint }]}>
                    <Text style={[styles.countryName, { color: item.dialCode === countryCode ? theme.mintText : theme.ink }]}>{item.name}</Text>
                    <Text style={[styles.countryDialCode, { color: item.dialCode === countryCode ? theme.emerald : theme.muted }]}>{item.dialCode}</Text>
                  </ScalePressable>
                </FadeInView>
              )}
              ListEmptyComponent={<Text style={[styles.emptyCountries, { color: theme.muted }]}>No country or region found.</Text>}
            />
          </View>
        </KeyboardAvoidView>
      </SlideUpModal>
    </View>
  );
}

const HERO_NAVY = '#0B1324';
const HERO_SOFT = '#A9B4C6';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboardArea: { flex: 1 },
  page: { flexGrow: 1, backgroundColor: HERO_NAVY },
  hero: { backgroundColor: HERO_NAVY, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 56, justifyContent: 'flex-end', overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  ringLarge: { width: 420, height: 420, borderRadius: 210, top: -170, right: -190 },
  ringMedium: { width: 280, height: 280, borderRadius: 140, top: -90, right: -110 },
  ringSmall: { width: 160, height: 160, borderRadius: 80, bottom: 30, left: -70 },
  heroLogo: { width: 72, height: 72, borderRadius: 20 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.9, marginTop: 28 },
  heroCopy: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  sheet: { flex: 1, marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sheetCopy: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, marginTop: 20, borderWidth: 1 },
  segmentItem: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '700' },
  form: { marginTop: 4 },
  field: { marginTop: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  otpHint: { fontSize: 13, marginTop: -4, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 14, gap: 10 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phoneInput: { flex: 1 },
  input: { flex: 1, fontSize: 15, height: '100%' },
  otpInput: { fontSize: 18, fontWeight: '700', letterSpacing: 4 },
  countryCodePicker: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  countryCodeText: { fontSize: 15, fontWeight: '700' },
  button: { height: 54, marginTop: 24, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: .65 },
  forgotLink: { marginTop: 16, alignItems: 'center', paddingVertical: 4 },
  link: { fontSize: 14, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 },
  terms: { fontSize: 12, fontWeight: '500' },
  countryModal: { maxHeight: '82%', borderRadius: 24, paddingBottom: 18 },
  modalHeader: { minHeight: 76, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 13, marginTop: 3 },
  closeButton: { padding: 10, marginRight: -10 },
  searchRow: { height: 48, borderWidth: 1, borderRadius: 14, margin: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, height: '100%', fontSize: 15 },
  countryOption: { minHeight: 54, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  countryName: { fontSize: 15, fontWeight: '600', flex: 1, paddingRight: 12 },
  countryDialCode: { fontSize: 14, fontWeight: '800' },
  emptyCountries: { textAlign: 'center', paddingVertical: 36, fontSize: 14 },
});
