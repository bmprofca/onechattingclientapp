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
  ArrowRight,
  ChevronRight,
  Wallet,
} from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import {
  getProjectDashboard,
  getUnreadCount,
} from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { ScreenSkeleton } from '../components/Skeleton';
import { useTheme, radii } from '../theme/theme';
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
  const [displayName, setDisplayName] = useState<string>(session.username || '');

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
        const name = accountProfile.profile?.name || accountProfile.username;
        if (name) setDisplayName(name);
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

  const tones: Record<string, { bg: string; fg: string }> = {
    danger: { bg: theme.dangerBg, fg: theme.danger },
    violet: { bg: theme.violetBg, fg: theme.violet },
    info: { bg: theme.infoBg, fg: theme.info },
    green: { bg: theme.mint, fg: theme.emerald },
    warning: { bg: theme.warnBg, fg: theme.warning },
  };

  const metricsData = [
    { label: 'Unread chats', value: formatCount(unread), tone: 'danger', icon: MessageCircle, onPress: onOpenUnread },
    { label: 'Scanned Users', value: formatCount(dashboardData?.qr_scanned_users?.total), tone: 'violet', icon: QrCode, onPress: onOpenScannedUsers },
    { label: 'Projects', value: formatCount(effectiveProjectCount), tone: 'info', icon: Briefcase, onPress: onOpenProjectsHub },
    { label: 'Contacts', value: formatCount(dashboardData?.contact?.total), tone: 'green', icon: Users, onPress: onOpenContacts },
    { label: 'Campaigns', value: formatCount(dashboardData?.campaign?.total), tone: 'warning', icon: Megaphone, onPress: onOpenCampaigns },
    { label: 'Chats', value: formatCount(dashboardData?.chat?.total), tone: 'green', icon: MessagesSquare, onPress: onOpenInbox },
    { label: 'Templates', value: formatCount(dashboardData?.template?.total), tone: 'violet', icon: FileText, onPress: onOpenTemplates },
    { label: 'Sent Today', value: formatCount(dashboardData?.message?.today_sent), tone: 'info', icon: Send },
    { label: 'Total Msgs', value: formatCount(dashboardData?.message?.total), tone: 'warning', icon: Inbox },
  ];
  // Unread chats is featured in the hero card; the rest go in the grid.
  const gridMetrics = metricsData.filter(m => m.label !== 'Unread chats');

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const firstName = (displayName || '').trim().split(/\s+/)[0] || '';
  const dateCaption = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const heroBg = theme.isDark ? theme.surface : theme.primary;
  const heroText = theme.isDark ? theme.ink : theme.onPrimary;
  const heroSoft = theme.isDark ? theme.muted : theme.primarySoft;

  return (
    <ScrollView
      style={{ backgroundColor: theme.canvas }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
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
          <FadeInView direction="down" distance={10} duration={320}>
            <View style={styles.greetingBlock}>
              <Text style={[styles.greeting, { color: theme.ink }]} numberOfLines={1}>
                Good {timeOfDay}
                {firstName ? `, ${firstName}` : ''}
              </Text>
              <Text style={[styles.dateCaption, { color: theme.muted }]}>
                {dateCaption}
              </Text>
            </View>

            <View
              style={[
                styles.hero,
                {
                  backgroundColor: heroBg,
                  borderColor: theme.isDark ? theme.border : heroBg,
                },
              ]}
            >
              <View style={styles.heroTop}>
                <Text style={[styles.heroLabel, { color: heroSoft }]}>
                  Unread chats
                </Text>
                <View style={[styles.heroIcon, { backgroundColor: 'rgba(43,212,125,0.16)' }]}>
                  <MessageCircle size={18} color={theme.accent} strokeWidth={2.4} />
                </View>
              </View>
              <Text style={[styles.heroValue, { color: heroText }]} numberOfLines={1}>
                {formatCount(unread)}
              </Text>
              <Text style={[styles.heroHint, { color: heroSoft }]}>
                {unread > 0
                  ? 'Customers are waiting for a reply'
                  : 'You are all caught up'}
              </Text>
              <View style={styles.heroActions}>
                <ScalePressable
                  accessibilityRole="button"
                  onPress={onOpenUnread ?? onOpenInbox}
                  disabled={!onOpenUnread && !onOpenInbox}
                  style={[styles.heroButton, { backgroundColor: theme.accent }]}
                >
                  <Text style={[styles.heroButtonText, { color: theme.onAccent }]}>
                    Open inbox
                  </Text>
                  <ArrowRight size={16} color={theme.onAccent} strokeWidth={2.6} />
                </ScalePressable>
                {onOpenInbox && onOpenUnread ? (
                  <ScalePressable
                    accessibilityRole="button"
                    onPress={onOpenInbox}
                    style={styles.heroGhost}
                    hitSlop={6}
                  >
                    <Text style={[styles.heroGhostText, { color: heroText }]}>
                      All chats
                    </Text>
                  </ScalePressable>
                ) : null}
              </View>
            </View>

            <ScalePressable
              onPress={onOpenWallet}
              disabled={!onOpenWallet}
              activeScale={0.98}
              style={[
                styles.wallet,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.tile, { backgroundColor: theme.mint }]}>
                <Wallet size={18} color={theme.emerald} strokeWidth={2.3} />
              </View>
              <View style={styles.walletText}>
                <Text style={[styles.walletLabel, { color: theme.muted }]}>
                  Wallet balance
                </Text>
                <Text style={[styles.walletValue, { color: theme.ink }]} numberOfLines={1}>
                  ₹{formattedBalance}
                </Text>
              </View>
              {onOpenWallet ? (
                <View style={styles.walletCta}>
                  <Text style={[styles.walletCtaText, { color: theme.emerald }]}>
                    Top up
                  </Text>
                  <ChevronRight size={16} color={theme.emerald} strokeWidth={2.4} />
                </View>
              ) : null}
            </ScalePressable>
          </FadeInView>

          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Overview</Text>
          <View style={styles.metrics}>
            {gridMetrics.map((metric) => {
              const Icon = metric.icon;
              const tone = tones[metric.tone] || tones.green;
              return (
                <View key={metric.label} style={styles.metricSlot}>
                  <ScalePressable
                    onPress={metric.onPress}
                    disabled={!metric.onPress}
                    activeScale={0.96}
                    style={[
                      styles.metric,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View style={[styles.tile, { backgroundColor: tone.bg }]}>
                      <Icon size={18} color={tone.fg} strokeWidth={2.3} />
                    </View>
                    <Text style={[styles.metricValue, { color: theme.ink }]} numberOfLines={1}>
                      {metric.value}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.muted }]} numberOfLines={1}>
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
  page: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  greetingBlock: { marginBottom: 16 },
  greeting: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  dateCaption: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: { fontSize: 13, fontWeight: '600' },
  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 4,
  },
  heroHint: { fontSize: 13, marginTop: 2 },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 14,
  },
  heroButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroButtonText: { fontSize: 15, fontWeight: '700' },
  heroGhost: { paddingVertical: 8, paddingHorizontal: 4 },
  heroGhostText: { fontSize: 14, fontWeight: '600', opacity: 0.9 },
  wallet: {
    marginTop: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletText: { flex: 1, minWidth: 0 },
  walletLabel: { fontSize: 12, fontWeight: '500' },
  walletValue: { fontSize: 17, fontWeight: '800', marginTop: 1 },
  walletCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  walletCtaText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricSlot: {
    width: '48.4%',
    marginBottom: 12,
  },
  metric: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 12,
  },
  metricLabel: { fontSize: 13, marginTop: 2 },
});
