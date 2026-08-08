import React, {useState} from 'react';
import {ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import Toast from 'react-native-toast-message';
import {Briefcase, Eye, EyeOff, Globe, Lock, Mail, Phone, User} from 'lucide-react-native';
import {login, register, requestPasswordReset} from '../api/auth';
import {saveSession, Session} from '../services/session';
import {useTheme} from '../theme/theme';

type AuthMode = 'login' | 'signup' | 'forgot';

export function AuthScreen({onAuthenticated}: {onAuthenticated: (session: Session) => void}) {
  const theme = useTheme();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firmName, setFirmName] = useState('');
  const [mobile, setMobile] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const submit = async () => {
    if (!email.trim() || (mode !== 'forgot' && !password)) {
      Toast.show({type: 'error', text1: 'Complete the form', text2: 'Fill in every required field.'});
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      Toast.show({type: 'error', text1: 'Name required', text2: 'Enter your name to create an account.'});
      return;
    }
    if (mode === 'signup' && !firmName.trim()) {
      Toast.show({type: 'error', text1: 'Company name required', text2: 'Enter your company or business name.'});
      return;
    }
    if (mode === 'signup' && !mobile.trim()) {
      Toast.show({type: 'error', text1: 'Mobile required', text2: 'Enter your mobile number.'});
      return;
    }
    if (mode === 'signup' && !countryCode.trim()) {
      Toast.show({type: 'error', text1: 'Country code required', text2: 'Enter your country dial code (e.g. +91).'});
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      Toast.show({type: 'error', text1: 'Passwords do not match'});
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login(email.trim(), password);
        const session: Session = {...result, projects: result.projects || []};
        await saveSession(session);
        Toast.show({type: 'success', text1: 'Signed in successfully'});
        onAuthenticated(session);
      } else if (mode === 'signup') {
        const result = await register({
          name: name.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
          firm_name: firmName.trim(),
          mobile: mobile.trim(),
          country_code: countryCode.trim(),
        });
        const session: Session = {...result, projects: result.projects || []};
        await saveSession(session);
        Toast.show({type: 'success', text1: 'Account created', text2: 'Welcome to 1chatting!'});
        onAuthenticated(session);
      } else {
        await requestPasswordReset(email.trim());
        Toast.show({type: 'success', text1: 'Reset link sent', text2: 'Check your email for password-reset instructions.'});
        switchMode('login');
      }
    } catch (error) {
      Toast.show({type: 'error', text1: mode === 'forgot' ? 'Could not send reset link' : 'Request failed', text2: error instanceof Error ? error.message : 'Please try again.'});
    } finally {
      setLoading(false);
    }
  };

  const content = mode === 'login'
    ? {eyebrow: 'WELCOME BACK', title: 'Your workspace,\nready when you are.', copy: 'Sign in to keep customer conversations moving.', action: 'Sign in'}
    : mode === 'signup'
      ? {eyebrow: 'CREATE ACCOUNT', title: 'Start something\nmeaningful.', copy: 'Create your secure 1chatting workspace.', action: 'Create account'}
      : {eyebrow: 'RESET PASSWORD', title: 'Get back into\nyour workspace.', copy: 'We will email you a secure reset link.', action: 'Send reset link'};

  const fieldStyle = {
    backgroundColor: theme.canvas,
    borderColor: theme.border,
  };

  return (
    <View style={[styles.safe, {backgroundColor: theme.canvas}]}>
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          <View style={[styles.heroGlowSecondary, {backgroundColor: theme.mintText, opacity: theme.isDark ? 0.07 : 0.05}]} />

          <View style={styles.brandRow}>
            <View style={[styles.logo, {backgroundColor: theme.mint, shadowColor: theme.emerald}]}>
              <Text style={[styles.logoText, {color: theme.mintText}]}>1</Text>
            </View>
            <Text style={[styles.brand, {color: theme.ink}]}>1chatting</Text>
          </View>

          <Text style={[styles.eyebrow, {color: theme.mintText}]}>{content.eyebrow}</Text>
          <Text style={[styles.title, {color: theme.ink}]}>{content.title}</Text>
          <Text style={[styles.copy, {color: theme.muted}]}>{content.copy}</Text>

          {/* Segmented mode switcher — only for login/signup, forgot is a separate flow */}
          {mode !== 'forgot' && (
            <View style={[styles.segment, {backgroundColor: theme.isDark ? theme.surface : theme.mint, borderColor: theme.border}]}>
              <Pressable
                onPress={() => switchMode('login')}
                style={[styles.segmentItem, mode === 'login' && {backgroundColor: theme.surface, shadowColor: theme.shadow, shadowOpacity: theme.isDark ? 0.3 : 0.08, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: mode === 'login' ? 2 : 0}]}
              >
                <Text style={[styles.segmentText, {color: mode === 'login' ? theme.ink : theme.muted}]}>Sign in</Text>
              </Pressable>
              <Pressable
                onPress={() => switchMode('signup')}
                style={[styles.segmentItem, mode === 'signup' && {backgroundColor: theme.surface, shadowColor: theme.shadow, shadowOpacity: theme.isDark ? 0.3 : 0.08, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: mode === 'signup' ? 2 : 0}]}
              >
                <Text style={[styles.segmentText, {color: mode === 'signup' ? theme.ink : theme.muted}]}>Create account</Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.form, {backgroundColor: theme.surface, borderColor: theme.border, borderWidth: theme.isDark ? 1 : 0, shadowColor: theme.shadow}]}>
            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={[styles.label, {color: theme.muted}]}>FULL NAME</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <User size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    placeholder="Your name"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, {color: theme.ink}]}
                  />
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, {color: theme.muted}]}>WORK EMAIL</Text>
              <View style={[styles.inputRow, fieldStyle]}>
                <Mail size={17} color={theme.muted} strokeWidth={2.25} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@company.com"
                  placeholderTextColor={theme.muted}
                  style={[styles.input, {color: theme.ink}]}
                />
              </View>
            </View>

            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={[styles.label, {color: theme.muted}]}>COMPANY / BUSINESS NAME</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Briefcase size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={firmName}
                    onChangeText={setFirmName}
                    autoCapitalize="words"
                    placeholder="Your company name"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, {color: theme.ink}]}
                  />
                </View>
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={[styles.label, {color: theme.muted}]}>MOBILE NUMBER</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Globe size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={countryCode}
                    onChangeText={setCountryCode}
                    keyboardType="phone-pad"
                    placeholder="+91"
                    placeholderTextColor={theme.muted}
                    style={[styles.countryCodeInput, {color: theme.ink, borderRightColor: theme.border}]}
                  />
                  <Phone size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    keyboardType="phone-pad"
                    placeholder="Mobile number"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, {color: theme.ink}]}
                  />
                </View>
              </View>
            )}

            {mode !== 'forgot' && (
              <View style={styles.field}>
                <Text style={[styles.label, {color: theme.muted}]}>PASSWORD</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Lock size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, {color: theme.ink}]}
                  />
                  <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    {showPassword
                      ? <EyeOff size={17} color={theme.muted} strokeWidth={2.25} />
                      : <Eye size={17} color={theme.muted} strokeWidth={2.25} />}
                  </Pressable>
                </View>
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={[styles.label, {color: theme.muted}]}>CONFIRM PASSWORD</Text>
                <View style={[styles.inputRow, fieldStyle]}>
                  <Lock size={17} color={theme.muted} strokeWidth={2.25} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password again"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, {color: theme.ink}]}
                  />
                </View>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={submit}
              style={({pressed}) => [
                styles.button,
                {backgroundColor: theme.emerald, shadowColor: theme.emeraldDark},
                pressed && !loading && styles.buttonPressed,
                loading && styles.disabled,
              ]}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.buttonText}>{content.action}</Text>}
            </Pressable>

            {mode === 'login' ? (
              <Pressable onPress={() => switchMode('forgot')} style={styles.forgotLink}>
                <Text style={[styles.link, {color: theme.mintText}]}>Forgot password?</Text>
              </Pressable>
            ) : mode === 'forgot' ? (
              <Pressable onPress={() => switchMode('login')} style={styles.forgotLink}>
                <Text style={[styles.link, {color: theme.mintText}]}>← Back to sign in</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.terms, {color: theme.muted}]}>Protected with secure, encrypted access.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  keyboardArea: {flex: 1},
  page: {flexGrow: 1, padding: 24, paddingTop: 28, paddingBottom: 40},
  heroGlowSecondary: {position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 120, left: -110, zIndex: -1},
  brandRow: {flexDirection: 'row', alignItems: 'center'},
  logo: {width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowOpacity: .5, shadowRadius: 14, elevation: 5},
  logoText: {fontSize: 25, fontWeight: '900'},
  brand: {fontSize: 23, fontWeight: '800', marginLeft: 10, letterSpacing: -0.3},
  eyebrow: {fontSize: 11, letterSpacing: 1.8, fontWeight: '800', marginTop: 48},
  title: {fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1, marginTop: 10},
  copy: {fontSize: 15, lineHeight: 22, marginTop: 10},
  segment: {flexDirection: 'row', borderRadius: 14, padding: 4, marginTop: 24, borderWidth: 1},
  segmentItem: {flex: 1, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  segmentText: {fontSize: 14, fontWeight: '700'},
  form: {borderRadius: 24, padding: 20, marginTop: 16, zIndex: 10, elevation: 10, shadowOpacity: .25, shadowRadius: 20, shadowOffset: {width: 0, height: 10}},
  field: {marginTop: 14},
  label: {fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7},
  inputRow: {flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, gap: 10},
  input: {flex: 1, fontSize: 15, height: '100%'},
  countryCodeInput: {width: 52, fontSize: 15, height: '100%', borderRightWidth: 1, marginRight: 4, textAlign: 'center'},
  button: {height: 54, marginTop: 22, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowOpacity: .35, shadowRadius: 9, elevation: 4},
  buttonPressed: {opacity: 0.9, transform: [{scale: 0.99}]},
  buttonText: {color: '#FFF', fontSize: 15, fontWeight: '800'},
  disabled: {opacity: .65},
  forgotLink: {marginTop: 16, alignItems: 'center'},
  link: {fontSize: 13, fontWeight: '800'},
  terms: {fontSize: 11, textAlign: 'center', marginTop: 24},
});