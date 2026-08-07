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
import { colors } from '../theme/theme';

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
  onSignOut,
}: {
  projectId: string;
  session: ApiSession;
  onSignOut: () => void;
}) {
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
    { title: 'Projects', note: 'Switch workspace' },
    { title: 'Wallet', note: 'Balance & top-up' },
    { title: 'Profile', note: 'Account details' },
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
          tintColor={colors.emerald}
        />
      }
    >
      <LoadState loading={loading} error={error} empty={false} onRetry={load} />
      {!loading && !error && (
        <>
          <View style={styles.overview}>
            <Text style={styles.overviewLabel}>AVAILABLE WALLET BALANCE</Text>
            <Text style={styles.balance}>Rs. {balance}</Text>
            <Text style={styles.overviewHint}>
              Use wallet credit for messages and campaigns
            </Text>
          </View>
          <View style={styles.metrics}>
            <Metric
              value={String(unread)}
              label="Unread chats"
              tone="emerald"
            />
            <Metric
              value={String(value.project_count || value.projects || '1')}
              label="Projects"
              tone="blue"
            />
          </View>
          <Text style={styles.sectionTitle}>Manage workspace</Text>
          <View style={styles.actionGrid}>
            {actions.map(action => (
              <View key={action.title} style={styles.actionCard}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionNote}>{action.note}</Text>
                <Text style={styles.actionArrow}>›</Text>
              </View>
            ))}
          </View>
          <View style={styles.projectCard}>
            <Text style={styles.projectCardLabel}>
              CURRENT WHATSAPP ACCOUNT
            </Text>
            <Text style={styles.projectCardTitle}>
              {String(
                value.waba_name || value.project_name || 'WhatsApp account',
              )}
            </Text>
            <Text style={styles.projectCardDetail}>
              {String(
                value.waba_id ||
                  'Configure business profile and messaging settings',
              )}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onSignOut}
            style={styles.signOut}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
function Metric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'emerald' | 'blue';
}) {
  return (
    <View style={[styles.metric, tone === 'blue' && styles.metricBlue]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 28 },
  overview: {
    backgroundColor: colors.ink,
    borderRadius: 21,
    padding: 20,
    marginTop: 20,
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#A5C5B8',
  },
  balance: { fontSize: 31, fontWeight: '800', color: '#FFF', marginTop: 7 },
  overviewHint: { fontSize: 12, color: '#C8DDD5', marginTop: 6 },
  metrics: { flexDirection: 'row', marginTop: 12 },
  metric: {
    flex: 1,
    backgroundColor: '#E2F5EA',
    borderRadius: 17,
    padding: 15,
    marginRight: 6,
  },
  metricBlue: { backgroundColor: '#E9EDFF', marginRight: 0, marginLeft: 6 },
  metricValue: { fontSize: 23, fontWeight: '800', color: colors.ink },
  metricLabel: { fontSize: 11, color: colors.muted, marginTop: 3 },
  sectionTitle: {
    fontSize: 16,
    color: colors.ink,
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
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 14,
    marginTop: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  actionNote: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
    marginTop: 5,
    width: '80%',
  },
  actionArrow: {
    position: 'absolute',
    right: 13,
    bottom: 10,
    fontSize: 21,
    color: colors.emerald,
  },
  projectCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 17,
    marginTop: 23,
  },
  projectCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.muted,
  },
  projectCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 8,
  },
  projectCardDetail: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 5,
  },
  signOut: { alignSelf: 'center', padding: 18, marginTop: 6 },
  signOutText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
});
