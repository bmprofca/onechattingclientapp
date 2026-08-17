import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import {
  getProjectDashboard,
  getUnreadCount,
} from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import {
  ScalePressable,
  FadeInView,
  PulseView,
} from '../components/animations';

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
  onBalanceUpdated,
  onOpenProfile,
  onOpenProjectsHub,
  onOpenInbox,
  onOpenWallet,
  onOpenSupport,
}: {
  projectId: string;
  session: ApiSession;
  balance?: string | number;
  projectCount?: number;
  onBalanceUpdated?: (balance: number) => void;
  onOpenProfile?: () => void;
  onOpenProjectsHub?: () => void;
  onOpenInbox?: () => void;
  onOpenWallet?: () => void;
  onOpenSupport?: () => void;
}) {
  const theme = useTheme();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [liveBalance, setLiveBalance] = useState<string | number | undefined>(balance);
  const [liveProjectCount, setLiveProjectCount] = useState<number | undefined>(projectCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const balanceUpdatedRef = React.useRef(onBalanceUpdated);
  balanceUpdatedRef.current = onBalanceUpdated;

  useEffect(() => {
    if (balance !== undefined) {
      setLiveBalance(balance);
    }
  }, [balance]);

  useEffect(() => {
    if (projectCount !== undefined) {
      setLiveProjectCount(projectCount);
    }
  }, [projectCount]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashData, unreadResult, accountProfile] = await Promise.all([
        getProjectDashboard(session, projectId),
        getUnreadCount(session, projectId),
        getAccountProfile(session).catch(() => null),
      ]);
      setDashboardData(dashData?.data || dashData);
      setUnread(Number(numericValue(unreadResult)) || 0);

      if (accountProfile) {
        if (accountProfile.balance !== undefined) {
          setLiveBalance(accountProfile.balance);
          balanceUpdatedRef.current?.(accountProfile.balance);
        }
        if (accountProfile.projectCount !== undefined) {
          setLiveProjectCount(accountProfile.projectCount);
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load this data.',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, session.token, session.username]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = socketManager.onTotalUnreadCount((data) => {
      if (typeof data?.count === 'number') {
        setUnread(data.count);
      }
    });
    return () => unsub();
  }, []);

  const rawBalance = liveBalance !== undefined ? liveBalance : (balance ?? 0);
  const parsedNum = typeof rawBalance === 'number'
    ? rawBalance
    : Number(String(rawBalance || '0').replace(/[^0-9.-]+/g, '')) || 0;
  const formattedBalance = parsedNum.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });

  const effectiveProjectCount = liveProjectCount ?? projectCount ?? 0;

  const metricsData = [
    { label: 'Unread chats', value: String(unread), tone: 'emerald' as const, isUnread: unread > 0, onPress: onOpenInbox },
    { label: 'Projects', value: String(effectiveProjectCount), tone: 'blue' as const, onPress: onOpenProjectsHub },
    { label: 'Contacts', value: String(dashboardData?.contact?.total || '0'), tone: 'emerald' as const },
    { label: 'Campaigns', value: String(dashboardData?.campaign?.total || '0'), tone: 'blue' as const },
    { label: 'Chats', value: String(dashboardData?.chat?.total || '0'), tone: 'emerald' as const, onPress: onOpenInbox },
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
          <FadeInView direction="down" distance={12} duration={350}>
            <ScalePressable
              onPress={onOpenWallet}
              disabled={!onOpenWallet}
              style={[
                styles.overview,
                {
                  backgroundColor: theme.emerald,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.overviewLabel, { color: '#FFF' }]}>
                AVAILABLE WALLET BALANCE
              </Text>
              <Text style={[styles.balance, { color: '#FFFFFF' }]}>
                ₹{formattedBalance}
              </Text>
              <Text style={[styles.overviewHint, { color: '#ffffff' }]}>
                Use wallet credit for messages and campaigns • Tap to top up
              </Text>
            </ScalePressable>
          </FadeInView>

          <View style={styles.metrics}>
            {metricsData.map((metric, index) => (
              <FadeInView
                key={metric.label}
                delay={60 + index * 30}
                distance={10}
                style={[
                  styles.metricCardWrap,
                  index % 2 === 0 ? { marginRight: '3%' } : {},
                ]}
              >
                <ScalePressable
                  onPress={metric.onPress}
                  disabled={!metric.onPress}
                  style={[
                    styles.metric,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  {metric.isUnread ? (
                    <PulseView duration={1200} maxScale={1.08} minScale={0.96}>
                      <Text style={[styles.metricValue, { color: theme.emerald }]}>
                        {metric.value}
                      </Text>
                    </PulseView>
                  ) : (
                    <Text style={[styles.metricValue, { color: theme.ink }]}>
                      {metric.value}
                    </Text>
                  )}
                  <Text style={[styles.metricLabel, { color: theme.muted }]}>
                    {metric.label}
                  </Text>
                </ScalePressable>
              </FadeInView>
            ))}
          </View>

          <FadeInView delay={250} duration={350}>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>
              Manage workspace
            </Text>
          </FadeInView>

          <View style={styles.actionGrid}>
            {actions.map((action, index) => (
              <FadeInView
                key={action.title}
                delay={280 + index * 35}
                distance={10}
                style={styles.actionCardWrap}
              >
                <ScalePressable
                  onPress={action.onPress}
                  disabled={!action.onPress}
                  style={[
                    styles.actionCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.actionTitle, { color: theme.ink }]}>
                    {action.title}
                  </Text>
                  <Text style={[styles.actionNote, { color: theme.muted }]}>
                    {action.note}
                  </Text>
                  <Text style={[styles.actionArrow, { color: theme.emerald }]}>
                    ›
                  </Text>
                </ScalePressable>
              </FadeInView>
            ))}
          </View>
        </>
      )}
    </ScrollView>
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
  metricCardWrap: {
    width: '48.5%',
    marginBottom: 10,
  },
  metric: {
    borderRadius: 17,
    padding: 15,
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
  actionCardWrap: {
    width: '48.5%',
    marginTop: 10,
  },
  actionCard: {
    minHeight: 102,
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
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
});