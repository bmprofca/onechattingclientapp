import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Toast as Host, ToastProvider } from 'react-native-toast-notifications';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';

type ToastPayload = { type?: string; text1?: string; text2?: string; visibilityTime?: number };

const Toast = {
  show(options: ToastPayload) {
    const raw = options.type || 'info';
    const type = raw === 'error' ? 'danger' : raw === 'success' ? 'success' : raw === 'warning' ? 'warning' : 'normal';
    Host.show(options.text2 || '\u00a0', {
      type,
      placement: 'top',
      duration: options.visibilityTime || 3200,
      animationType: 'slide-in',
      data: { title: options.text1 || options.text2 || '' },
    });
  },
};

function Banner({ toast }: { toast: any }) {
  const kind = toast.type === 'danger' ? 'error' : toast.type === 'success' ? 'success' : toast.type === 'warning' ? 'warning' : 'info';
  const palette = {
    success: { bar: '#12A150', icon: '#12A150', bg: '#F3FBF6', wash: '#E5F6EC' },
    error: { bar: '#E5484D', icon: '#E5484D', bg: '#FFF6F6', wash: '#FDECEC' },
    warning: { bar: '#D97706', icon: '#D97706', bg: '#FFF9F0', wash: '#FDF1DE' },
    info: { bar: '#128C7E', icon: '#128C7E', bg: '#F4FBFA', wash: '#E7F6F4' },
  }[kind];
  const rawBody = String(toast.message || '').replace(/\u00a0/g, '').trim();
  const title = String(toast.data?.title || rawBody);
  const body = rawBody && rawBody !== title ? rawBody : '';
  const Icon = kind === 'success' ? CheckCircle2 : kind === 'error' ? AlertCircle : Info;

  return (
    <Pressable onPress={() => toast.onHide()} style={[styles.card, { backgroundColor: palette.bg }]}>
      <View style={[styles.accent, { backgroundColor: palette.bar }]} />
      <View style={[styles.iconWrap, { backgroundColor: palette.wash }]}>
        <Icon size={18} color={palette.icon} />
      </View>
      <View style={styles.copy}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

const renderType = {
  success: (toast: any) => <Banner toast={toast} />,
  danger: (toast: any) => <Banner toast={toast} />,
  warning: (toast: any) => <Banner toast={toast} />,
  normal: (toast: any) => <Banner toast={toast} />,
};

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider
      placement="top"
      duration={3200}
      animationType="slide-in"
      offsetTop={8}
      swipeEnabled
      renderType={renderType}
    >
      {children}
    </ToastProvider>
  );
}

export default Toast;

const styles = StyleSheet.create({
  card: {
    width: '92%',
    minHeight: 64,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  accent: { width: 5, alignSelf: 'stretch' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  copy: { flex: 1, paddingVertical: 12, paddingRight: 14, paddingLeft: 10 },
  title: { color: '#111B21', fontSize: 14, fontWeight: '800' },
  body: { color: '#3B4A54', fontSize: 13, lineHeight: 18, marginTop: 2 },
});
