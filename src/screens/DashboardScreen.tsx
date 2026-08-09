import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiSession } from '../api/client';
import { getProjectMeta, getUnreadCount } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';

const numericValue = (value: any) =>
  value?.data?.count ??
  value?.count ??
  value?.data?.total ??
  value?.total ??
  value?.data?.unread_count ??
  value?.unread_count ??
  0;

export function DashboardScreen({
  projectId,
  session,
  onOpenProfile,
  onOpenProjectsHub,
  onOpenInbox,
  onOpenWallet,
  onOpenWaba,
}: {
  projectId: string;
  session: ApiSession;
  onOpenProfile?: () => void;
  onOpenProjectsHub?: () => void;
  onOpenInbox?: () => void;
  onOpenWallet?: () => void;
  onOpenWaba?: () => void;
}) {
  const theme = useTheme();
  const [info, setInfo] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectInfo, unreadResult] = await Promise.all([
        getProjectMeta(session, projectId),
        getUnreadCount(session, projectId),
      ]);
      setInfo(projectInfo);
      setUnread(Number(numericValue(unreadResult)) || 0);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load this data.',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, session]);
  useEffect(() => {
    load();
  }, [load]);
  const value = info?.data || info || {};
  const balance = String(value.wallet_balance || value.balance || '0');
  const actions = [
    { title: 'Projects', note: 'Switch workspace', onPress: onOpenProjectsHub },
    { title: 'Wallet', note: 'Balance & top-up', onPress: onOpenWallet },
    { title: 'Profile', note: 'Account details', onPress: onOpenProfile },
    { title: 'Automation', note: 'Replies & agents' },
    { title: 'Team', note: 'People & access' },
    { title: 'Support', note: 'Help center' },
  ];
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={theme.emerald}
        />
      }
    >
      <LoadState loading={false} error={error} empty={false} onRetry={load} />
      {!loading && !error && (
        <>
          <View style={[styles.overview, { backgroundColor: theme.isDark ? '#1E293B' : '#011118ff' }]}>
            <Text style={styles.overviewLabel}>AVAILABLE WALLET BALANCE</Text>
            <Text style={styles.balance}>₹{balance}</Text>
            <Text style={styles.overviewHint}>
              Use wallet credit for messages and campaigns
            </Text>
          </View>
          <View style={styles.metrics}>
            <Metric
              value={String(unread)}
              label="Unread chats"
              tone="emerald"
              theme={theme}
            />
            <Metric
              value={String(value.project_count || value.projects || '1')}
              label="Projects"
              tone="blue"
              theme={theme}
            />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Manage workspace</Text>
          <View style={styles.actionGrid}>
            {actions.map(action => (
              <Pressable
                key={action.title}
                onPress={action.onPress}
                disabled={!action.onPress}
                style={[
                  styles.actionCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.actionTitle, { color: theme.ink }]}>{action.title}</Text>
                <Text style={[styles.actionNote, { color: theme.muted }]}>{action.note}</Text>
                <Text style={[styles.actionArrow, { color: theme.emerald }]}>›</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.projectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={[styles.projectCardLabel, { color: theme.muted }]}>
                  CURRENT WHATSAPP ACCOUNT
                </Text>
                <Text style={[styles.projectCardTitle, { color: theme.ink }]}>
                  {String(
                    value.waba_name || value.project_name || 'WhatsApp account',
                  )}
                </Text>
              </View>
              <Text style={[{ color: value.waba_id ? theme.emerald : theme.warning, fontSize: 12, fontWeight: '700', backgroundColor: value.waba_id ? theme.mint : 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }]}>
                {value.waba_id ? 'CONNECTED' : 'NOT CONNECTED'}
              </Text>
            </View>
            <Text style={[styles.projectCardDetail, { color: theme.muted }]}>
              {String(
                value.waba_id ||
                  'Connect your business profile and messaging settings.',
              )}
            </Text>
            <Pressable
              onPress={onOpenWaba}
              style={[
                styles.wabaButton,
                { backgroundColor: value.waba_id ? theme.surface : theme.emerald, borderColor: value.waba_id ? theme.border : theme.emerald }
              ]}
            >
              <Text style={[
                styles.wabaButtonText,
                { color: value.waba_id ? theme.ink : '#FFF' }
              ]}>
                {value.waba_id ? 'Manage WhatsApp Account' : 'Connect Meta Account'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}
function Metric({
  value,
  label,
  tone,
  theme,
}: {
  value: string;
  label: string;
  tone: 'emerald' | 'blue';
  theme: any;
}) {
  return (
    <View style={[
      styles.metric,
      { backgroundColor: tone === 'emerald' ? theme.mint : (theme.isDark ? '#1E293B' : '#E9EDFF') },
      tone === 'blue' && styles.metricBlue,
    ]}>
      <Text style={[styles.metricValue, { color: tone === 'emerald' ? (theme.isDark ? theme.mintText : theme.ink) : theme.ink }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 28 },
  overview: {
    borderRadius: 21,
    padding: 20,
    marginTop: 20,
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#d5dddaff',
  },
  balance: { fontSize: 31, fontWeight: '800', color: '#FFF', marginTop: 7 },
  overviewHint: { fontSize: 12, color: '#C8DDD5', marginTop: 6 },
  metrics: { flexDirection: 'row', marginTop: 12 },
  metric: {
    flex: 1,
    borderRadius: 17,
    padding: 15,
    marginRight: 6,
  },
  metricBlue: { marginRight: 0, marginLeft: 6 },
  metricValue: { fontSize: 23, fontWeight: '800' },
  metricLabel: { fontSize: 11, marginTop: 3 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48.5%',
    minHeight: 102,
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
    marginTop: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: '800' },
  actionNote: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
    width: '80%',
  },
  actionArrow: {
    position: 'absolute',
    right: 13,
    bottom: 10,
    fontSize: 21,
  },
  projectCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 17,
    marginTop: 23,
  },
  projectCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  projectCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  projectCardDetail: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 16,
  },
  wabaButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wabaButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
