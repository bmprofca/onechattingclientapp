import React, {useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {login, register, requestPasswordReset} from '../api/auth';
import {saveSession, Session} from '../services/session';

type AuthMode = 'login' | 'signup' | 'forgot';

export function AuthScreen({onAuthenticated}: {onAuthenticated: (session: Session) => void}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
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
        await register(name.trim(), email.trim(), password);
        Toast.show({type: 'success', text1: 'Account created', text2: 'You can now sign in.'});
        switchMode('login');
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

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <View style={styles.heroGlow} />
        <View style={styles.brandRow}><View style={styles.logo}><Text style={styles.logoText}>1</Text></View><Text style={styles.brand}>1chatting</Text></View>
        <Text style={styles.eyebrow}>{content.eyebrow}</Text>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.copy}>{content.copy}</Text>
        <View style={styles.form}>
          {mode === 'signup' && <><Text style={styles.label}>FULL NAME</Text><TextInput value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" placeholderTextColor="#9AA5B8" style={styles.input} /></>}
          <Text style={[styles.label, mode === 'signup' && styles.spacedLabel]}>WORK EMAIL</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@company.com" placeholderTextColor="#9AA5B8" style={styles.input} />
          {mode !== 'forgot' && <><Text style={[styles.label, styles.spacedLabel]}>PASSWORD</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" placeholderTextColor="#9AA5B8" style={styles.input} /></>}
          {mode === 'signup' && <><Text style={[styles.label, styles.spacedLabel]}>CONFIRM PASSWORD</Text><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Enter password again" placeholderTextColor="#9AA5B8" style={styles.input} /></>}
          <Pressable accessibilityRole="button" disabled={loading} onPress={submit} style={[styles.button, loading && styles.disabled]}><Text style={styles.buttonText}>{loading ? 'Please wait...' : content.action}</Text></Pressable>
          {mode === 'login' ? <View style={styles.links}><Pressable onPress={() => switchMode('forgot')}><Text style={styles.link}>Forgot password?</Text></Pressable><Pressable onPress={() => switchMode('signup')}><Text style={styles.link}>Create account</Text></Pressable></View> : <Pressable onPress={() => switchMode('login')}><Text style={styles.backLink}>← Back to sign in</Text></Pressable>}
        </View>
        <Text style={styles.terms}>Protected with secure, encrypted access.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#10172A'}, keyboardArea:{flex:1}, page:{flexGrow:1,padding:24,paddingTop:28,paddingBottom:32}, heroGlow:{position:'absolute',width:260,height:260,borderRadius:130,backgroundColor:'#293B73',opacity:.55,top:-125,right:-70}, brandRow:{flexDirection:'row',alignItems:'center'}, logo:{width:40,height:40,borderRadius:14,backgroundColor:'#8DE2C2',alignItems:'center',justifyContent:'center',shadowColor:'#8DE2C2',shadowOpacity:.5,shadowRadius:14,elevation:5}, logoText:{fontSize:25,fontWeight:'900',color:'#12213B'}, brand:{fontSize:23,color:'#FFF',fontWeight:'800',marginLeft:10}, eyebrow:{fontSize:11,letterSpacing:1.8,fontWeight:'800',color:'#8DE2C2',marginTop:52}, title:{fontSize:35,lineHeight:42,fontWeight:'800',color:'#FFF',letterSpacing:-1,marginTop:11}, copy:{fontSize:15,lineHeight:22,color:'#BEC9E5',marginTop:12}, form:{backgroundColor:'#F9FAFF',borderRadius:24,padding:21,marginTop:30,zIndex:10,elevation:10,shadowColor:'#030712',shadowOpacity:.3,shadowRadius:18,shadowOffset:{width:0,height:8}}, label:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:'#62708A'}, spacedLabel:{marginTop:16}, input:{height:52,borderWidth:1,borderColor:'#D8DDEB',borderRadius:13,paddingHorizontal:14,marginTop:7,color:'#17213A',fontSize:15,backgroundColor:'#FFF'}, button:{height:54,marginTop:23,borderRadius:14,justifyContent:'center',alignItems:'center',backgroundColor:'#5569C8',shadowColor:'#4052AC',shadowOpacity:.35,shadowRadius:9,elevation:4}, buttonText:{color:'#FFF',fontSize:15,fontWeight:'800'}, disabled:{opacity:.65}, links:{flexDirection:'row',justifyContent:'space-between',marginTop:20}, link:{fontSize:13,fontWeight:'800',color:'#5569C8'}, backLink:{textAlign:'center',fontSize:13,fontWeight:'800',color:'#5569C8',marginTop:20}, terms:{color:'#AAB6D2',fontSize:11,textAlign:'center',marginTop:22}
});
