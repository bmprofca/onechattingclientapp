import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Briefcase,
  FileText,
  MessageCircle,
  MessagesSquare,
  Megaphone,
  QrCode,
  Send,
  Users,
  Inbox,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import {
  getProjectDashboard,
  getUnreadCount,
} from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { ScreenSkeleton } from '../components/Skeleton';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import {
  ScalePressable,
  FadeInView,
} from '../components/animations';

function formatCount(value: any) {
  const num = Number(String(value ?? 0).replace(/[^0-9.-]+/g, ''));
  if (!Number.isFinite(num)) return '0';
  return Math.round(num).toLocaleString('en-IN');
}

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
  onOpenProjectsHub,
  onOpenInbox,
  onOpenUnread,
  onOpenWallet,
  onOpenScannedUsers,
  onOpenContacts,
  onOpenCampaigns,
  onOpenTemplates,
}: {
  projectId: string;
  session: ApiSession;
  balance?: string | number;
  projectCount?: number;
  onBalanceUpdated?: (balance: number) => void;
  onOpenProjectsHub?: () => void;
  onOpenInbox?: () => void;
  onOpenUnread?: () => void;
  onOpenWallet?: () => void;
  onOpenScannedUsers?: () => void;
  onOpenContacts?: () => void;
  onOpenCampaigns?: () => void;
  onOpenTemplates?: () => void;
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
    { label: 'Unread chats', value: formatCount(unread), color: '#E5484D', icon: MessageCircle, onPress: onOpenUnread },
    { label: 'Scanned Users', value: formatCount(dashboardData?.qr_scanned_users?.total), color: '#7C3AED', icon: QrCode, onPress: onOpenScannedUsers },
    { label: 'Projects', value: formatCount(effectiveProjectCount), color: '#2563EB', icon: Briefcase, onPress: onOpenProjectsHub },
    { label: 'Contacts', value: formatCount(dashboardData?.contact?.total), color: '#0D9488', icon: Users, onPress: onOpenContacts },
    { label: 'Campaigns', value: formatCount(dashboardData?.campaign?.total), color: '#D97706', icon: Megaphone, onPress: onOpenCampaigns },
    { label: 'Chats', value: formatCount(dashboardData?.chat?.total), color: '#059669', icon: MessagesSquare, onPress: onOpenInbox },
    { label: 'Templates', value: formatCount(dashboardData?.template?.total), color: '#4F46E5', icon: FileText, onPress: onOpenTemplates },
    { label: 'Sent Today', value: formatCount(dashboardData?.message?.today_sent), color: '#0284C7', icon: Send },
    { label: 'Total Msgs', value: formatCount(dashboardData?.message?.total), color: '#DB2777', icon: Inbox },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={loading && !!dashboardData}
          onRefresh={load}
          tintColor={theme.emerald}
        />
      }
    >
      {loading && !dashboardData ? (
        <ScreenSkeleton variant="dashboard" />
      ) : error && !dashboardData ? (
        <LoadState loading={false} error={error} empty={false} onRetry={load} />
      ) : (
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
            {metricsData.map((metric) => {
              const Icon = metric.icon;
              return (
                <View key={metric.label} style={styles.metricSlot}>
                <ScalePressable
                  onPress={metric.onPress}
                  disabled={!metric.onPress}
                  activeScale={0.94}
                  style={[
                    styles.metric,
                    {
                      backgroundColor: theme.isDark ? `${metric.color}2A` : `${metric.color}14`,
                      borderColor: theme.isDark ? `${metric.color}66` : `${metric.color}33`,
                    },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: metric.color }]}>
                    <Icon size={15} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.metricValue, { color: metric.color }]} numberOfLines={1}>
                    {metric.value}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.muted }]} numberOfLines={2}>
                    {metric.label}
                  </Text>
                </ScalePressable>
                </View>
              );
            })}
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metricSlot: {
    width: '31.5%',
    marginBottom: 10,
  },
  metric: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 11, marginTop: 3, lineHeight: 14 },
});
