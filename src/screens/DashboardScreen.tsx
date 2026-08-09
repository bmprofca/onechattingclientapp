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
import { getProjectMeta, getProjectDashboard, getUnreadCount } from '../api/workspace';
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
  balance,
  projectCount,
  onOpenProfile,
  onOpenProjectsHub,
  onOpenInbox,
  onOpenWallet,
  onOpenWaba,
  onOpenSupport,
}: {
  projectId: string;
  session: ApiSession;
  balance: string;
  projectCount: number;
  onOpenProfile?: () => void;
  onOpenProjectsHub?: () => void;
  onOpenInbox?: () => void;
  onOpenWallet?: () => void;
  onOpenWaba?: () => void;
  onOpenSupport?: () => void;
}) {
  const theme = useTheme();
  const [info, setInfo] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectInfo, dashData, unreadResult] = await Promise.all([
        getProjectMeta(session, projectId),
        getProjectDashboard(session, projectId),
        getUnreadCount(session, projectId),
      ]);
      setInfo(projectInfo);
      setDashboardData(dashData?.data || dashData);
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
  
  const metricsData = [
    { label: 'Unread chats', value: String(unread), tone: 'emerald' as const },
    { label: 'Projects', value: String(projectCount), tone: 'blue' as const },
    { label: 'Contacts', value: String(dashboardData?.contact?.total || '0'), tone: 'emerald' as const },
    { label: 'Campaigns', value: String(dashboardData?.campaign?.total || '0'), tone: 'blue' as const },
    { label: 'Chats', value: String(dashboardData?.chat?.total || '0'), tone: 'emerald' as const },
    { label: 'Templates', value: String(dashboardData?.template?.total || '0'), tone: 'blue' as const },
    { label: 'Sent Today', value: String(dashboardData?.message?.today_sent || '0'), tone: 'emerald' as const },
    { label: 'Total Msgs', value: String(dashboardData?.message?.total || '0'), tone: 'blue' as const },
  ];

  const actions = [
    { title: 'Projects', note: 'Switch workspace', onPress: onOpenProjectsHub },
    { title: 'Wallet', note: 'Balance & top-up', onPress: onOpenWallet },
    { title: 'Profile', note: 'Account details', onPress: onOpenProfile },
    { title: 'Support', note: 'Help center', onPress: onOpenSupport },
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
          <View style={[
            styles.overview, 
            { 
              backgroundColor: theme.emerald,
              borderColor: theme.border,
              borderWidth: 1,
            }
          ]}>
            <Text style={[styles.overviewLabel, { color: theme.header }]}>AVAILABLE WALLET BALANCE</Text>
            <Text style={[styles.balance, { color: theme.header }]}>₹{balance}</Text>
            <Text style={[styles.overviewHint, { color: theme.header }]}>
              Use wallet credit for messages and campaigns
            </Text>
          </View>
          <View style={styles.metrics}>
            {metricsData.map((metric, index) => (
              <Metric
                key={metric.label}
                value={metric.value}
                label={metric.label}
                tone={metric.tone}
                theme={theme}
                style={[
                  styles.metricCard,
                  index % 2 === 0 ? { marginRight: '3%' } : {}
                ]}
              />
            ))}
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
  style,
}: {
  value: string;
  label: string;
  tone: 'emerald' | 'blue';
  theme: any;
  style?: any;
}) {
  return (
    <View style={[
      styles.metric,
      { 
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
      },
      style,
    ]}>
      <Text style={[styles.metricValue, { color: theme.ink }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { padding: 10, paddingBottom: 28 },
  overview: {
    borderRadius: 21,
    padding: 20,
    marginTop: 10,
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#ffffffff',
  },
  balance: { fontSize: 31, fontWeight: '800', color: '#FFF', marginTop: 7 },
  overviewHint: { fontSize: 12, color: '#d9dedcff', marginTop: 6 },
  metrics: { 
    flexDirection: 'row', 
    marginTop: 12,
    flexWrap: 'wrap',
  },
  metric: {
    borderRadius: 17,
    padding: 15,
  },
  metricCard: {
    width: '48.5%',
    marginBottom: 10,
  },
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
