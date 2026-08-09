import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Briefcase, FolderPlus, Package, CheckCircle2, Circle } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { createProject } from '../api/workspace';
import { useTheme } from '../theme/theme';

export function CreateProjectScreen({
  session,
  onBack,
  onCreated,
}: {
  session: ApiSession;
  onBack: () => void;
  onCreated: (newProject: { id: string; name: string }) => void;
}) {
  const theme = useTheme();
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [packageId, setPackageId] = useState('PROJECT_1M');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!companyName.trim()) {
      Toast.show({ type: 'error', text1: 'Company Name Required', text2: 'Please enter a company name.' });
      return;
    }
    if (!projectName.trim()) {
      Toast.show({ type: 'error', text1: 'Project Name Required', text2: 'Please enter a project name.' });
      return;
    }

    setLoading(true);
    try {
      const res = await createProject(session, companyName.trim(), projectName.trim(), packageId);
      Toast.show({ type: 'success', text1: 'Project Created', text2: 'Your new workspace is ready.' });
      if (res.data?.project_id) {
        onCreated({ id: String(res.data.project_id), name: res.data.name });
      } else {
        // Fallback if structure is unexpected
        onCreated({ id: '', name: projectName.trim() }); 
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Creation Failed',
        text2: error instanceof Error ? error.message : 'Unable to create project.',
      });
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
      {/* Sleek Header */}
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <Text style={[styles.backButtonText, { color: theme.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>New Project</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              <Text style={[styles.label, { color: theme.muted }]}>SUBSCRIPTION PACKAGE</Text>
              
              <Pressable
                onPress={() => setPackageId('PROJECT_1M')}
                style={[
                  styles.packageOption,
                  fieldStyle,
                  packageId === 'PROJECT_1M' && { borderColor: theme.emerald, backgroundColor: theme.mint }
                ]}
              >
                <View style={styles.packageOptionContent}>
                  <Package size={17} color={packageId === 'PROJECT_1M' ? theme.emerald : theme.muted} strokeWidth={2.25} />
                  <View style={styles.packageOptionTexts}>
                    <Text style={[styles.packageOptionTitle, { color: packageId === 'PROJECT_1M' ? theme.emerald : theme.ink }]}>Basic Plan</Text>
                    <Text style={[styles.packageOptionDesc, { color: packageId === 'PROJECT_1M' ? theme.emerald : theme.muted }]}>Up to 1M messages</Text>
                  </View>
                </View>
                {packageId === 'PROJECT_1M' ? <CheckCircle2 size={20} color={theme.emerald} /> : <Circle size={20} color={theme.border} />}
              </Pressable>

              <Pressable
                onPress={() => setPackageId('PROJECT_2M')}
                style={[
                  styles.packageOption,
                  fieldStyle,
                  packageId === 'PROJECT_2M' && { borderColor: theme.emerald, backgroundColor: theme.mint },
                  { marginTop: 10 }
                ]}
              >
                <View style={styles.packageOptionContent}>
                  <Package size={17} color={packageId === 'PROJECT_2M' ? theme.emerald : theme.muted} strokeWidth={2.25} />
                  <View style={styles.packageOptionTexts}>
                    <Text style={[styles.packageOptionTitle, { color: packageId === 'PROJECT_2M' ? theme.emerald : theme.ink }]}>Premium Plan</Text>
                    <Text style={[styles.packageOptionDesc, { color: packageId === 'PROJECT_2M' ? theme.emerald : theme.muted }]}>Up to 2M messages</Text>
                  </View>
                </View>
                {packageId === 'PROJECT_2M' ? <CheckCircle2 size={20} color={theme.emerald} /> : <Circle size={20} color={theme.border} />}
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={handleCreate}
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
                <Text style={styles.buttonText}>Create Project</Text>
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
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 40,
    marginTop: -4, // optical adjustment for chevron
  },
  headerTitle: {
    fontSize: 17,
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
  packageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
  },
  packageOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  packageOptionTexts: {
    justifyContent: 'center',
  },
  packageOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  packageOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
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
});
