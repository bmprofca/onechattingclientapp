import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {login} from '../api/auth';
import {saveSession, Session} from '../services/session';
import {colors, ui} from '../theme/theme';

export function AuthScreen({onAuthenticated}: {onAuthenticated: (session: Session) => void}) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  const signIn = async () => {
    if (!email.trim() || !password) {
      Toast.show({type: 'error', text1: 'Missing details', text2: 'Enter your work email and password.'});
      return;
    }
    setLoading(true);
    try { const result = await login(email.trim(), password); const session: Session = {...result, projects: result.projects || []}; await saveSession(session); Toast.show({type: 'success', text1: 'Signed in successfully'}); onAuthenticated(session); }
    catch (error) { Toast.show({type: 'error', text1: 'Sign in failed', text2: error instanceof Error ? error.message : 'Please try again.'}); }
    finally { setLoading(false); }
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.logo}><Text style={styles.logoText}>1</Text></View><Text style={styles.brand}>1chatting</Text><Text style={styles.kicker}>WELCOME BACK</Text><Text style={styles.title}>Customer conversations,{`\n`}made simpler.</Text><Text style={styles.copy}>Sign in to your WhatsApp business workspace.</Text><View style={styles.form}><Text style={ui.label}>WORK EMAIL</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@company.com" placeholderTextColor="#99AAA4" style={styles.input} /><Text style={[ui.label, {marginTop: 16}]}>PASSWORD</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" placeholderTextColor="#99AAA4" style={styles.input} /><Pressable accessibilityRole="button" disabled={loading} onPress={signIn} style={[ui.button, {marginTop: 24}, loading && styles.disabled]}><Text style={ui.buttonText}>{loading ? 'Signing in…' : 'Sign in  →'}</Text></Pressable><Pressable><Text style={styles.forgot}>Forgot password?</Text></Pressable></View><Text style={styles.terms}>Securely connected to your 1Chatting account.</Text></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#0E2921'},page:{padding:24,paddingTop:38,flexGrow:1},logo:{width:39,height:39,borderRadius:13,backgroundColor:'#6BE0A0',alignItems:'center',justifyContent:'center'},logoText:{fontSize:25,fontWeight:'900',color:'#143A2F'},brand:{fontSize:23,color:'#FFF',fontWeight:'800',marginTop:10},kicker:{fontSize:10,letterSpacing:1.5,fontWeight:'800',color:'#75DDA9',marginTop:70},title:{fontSize:34,lineHeight:41,fontWeight:'800',color:'#FFF',letterSpacing:-1,marginTop:12},copy:{fontSize:15,lineHeight:22,color:'#B7CDC5',marginTop:12},form:{backgroundColor:'#FFF',borderRadius:23,padding:21,marginTop:32},input:{height:51,borderWidth:1,borderColor:'#DCE6E1',borderRadius:12,paddingHorizontal:14,marginTop:7,color:colors.ink,fontSize:15},disabled:{opacity:.65},forgot:{textAlign:'center',color:colors.emerald,fontSize:13,fontWeight:'700',marginTop:19},terms:{color:'#A4BEB4',fontSize:11,textAlign:'center',marginTop:22}});
