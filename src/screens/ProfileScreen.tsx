import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import { Session } from '../services/session';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';

import { formatImageUrl } from '../utils/imageUrl';
import { Image } from 'react-native';

export function ProfileScreen({
  session,
  apiSession,
  onSignOut,
  onBack,
}: {
  session: Session;
  apiSession: ApiSession;
  onSignOut: () => void;
  onBack?: () => void;
}) {
  const theme = useTheme();
  const [profileData, setProfileData] = useState<any>(session);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const updated = await getAccountProfile(apiSession);
      setProfileData((prev: any) => ({
        ...prev,
        ...updated,
      }));
    } catch (err) {
      if (!profileData?.profile) {
        setError(err instanceof Error ? err.message : 'Could not fetch profile');
      }
    } finally {
      setLoading(false);
    }
  }, [apiSession, profileData?.profile]);

  useEffect(() => {
    loadProfile();
  }, []);

  const profile = profileData?.profile || session.profile || {};
  const rawProfileImg =
    profile.profile_picture_url ||
    profile.profile_image ||
    profile.profile_picture ||
    profile.image ||
    profile.photo ||
    '';
  const profileImgUrl = formatImageUrl(rawProfileImg);
  const name = profile.name || session.username || 'User';
  const email = profile.email || 'No email specified';
  const mobile = profile.mobile
    ? `+${profile.country_code || '91'} ${profile.mobile}`
    : 'No mobile specified';
  const gender = profile.gender
    ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
    : 'Not specified';
  const firmName = profile.firm_name || 'None';
  const businessName = profile.business_name || 'None';
  const businessType = profile.business_type || 'None';
  const balance = Number(profileData?.balance ?? session.balance ?? 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
  const projectCount = profileData?.projectCount ?? session.projectCount ?? session.projects?.length ?? 0;
  const username = profileData?.username || session.username || '';

  const initial = name.trim().charAt(0).toUpperCase() || 'U';

  return (
    <View style={[styles.safe, { backgroundColor: theme.canvas }]}>
      {onBack && (
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
            <ArrowLeft size={22} color={theme.ink} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
      )}
      <ScrollView
        style={[styles.container, { backgroundColor: theme.canvas }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadProfile}
            tintColor={theme.emerald}
          />
        }
      >
        <LoadState loading={false} error={error} empty={false} onRetry={loadProfile} />

        {/* Profile Header Hero */}
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {profileImgUrl && !imgError ? (
          <View style={[styles.avatar, { borderColor: theme.emerald, overflow: 'hidden' }]}>
            <Image
              source={{ uri: profileImgUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          </View>
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.mint, borderColor: theme.emerald }]}>
            <Text style={[styles.avatarText, { color: theme.emerald }]}>{initial}</Text>
          </View>
        )}
        <Text style={[styles.userName, { color: theme.ink }]}>{name}</Text>
        <Text style={[styles.userEmail, { color: theme.muted }]}>{email}</Text>
        <Text style={[styles.userMobile, { color: theme.emerald }]}>{mobile}</Text>
      </View>

      {/* Balance & Account Overview */}
      <View style={styles.statsRow}>
        <View style={[
          styles.statCard, 
          { 
            backgroundColor: theme.isDark ? theme.surface : '#EEF2FF',
            borderColor: theme.isDark ? theme.border : '#E0E7FF',
            borderWidth: 1,
          }
        ]}>
          <Text style={[styles.statLabel, { color: theme.isDark ? theme.muted : '#4338CA' }]}>WALLET BALANCE</Text>
          <Text style={[styles.statValue, { color: theme.ink }]}>₹{balance}</Text>
        </View>
        <View style={[
          styles.statCard, 
          { 
            backgroundColor: theme.isDark ? theme.surface : '#E6F4ED',
            borderColor: theme.isDark ? theme.border : '#D1E7DD',
            borderWidth: 1,
          }
        ]}>
          <Text style={[styles.statLabel, { color: theme.isDark ? theme.muted : '#047857' }]}>TOTAL PROJECTS</Text>
          <Text style={[styles.statValue, { color: theme.ink }]}>{projectCount}</Text>
        </View>
      </View>

      {/* Account Info Details */}
      <Text style={[styles.sectionHeader, { color: theme.ink }]}>Personal Information</Text>
      <View style={[styles.detailsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <DetailRow label="Full Name" value={name} theme={theme} />
        <DetailRow label="Email Address" value={email} theme={theme} />
        <DetailRow label="Mobile Number" value={mobile} theme={theme} />
        <DetailRow label="Gender" value={gender} theme={theme} />
        <DetailRow label="Username ID" value={username} theme={theme} isLast />
      </View>

      {/* Business Details */}
      <Text style={[styles.sectionHeader, { color: theme.ink }]}>Business Information</Text>
      <View style={[styles.detailsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <DetailRow label="Firm Name" value={firmName} theme={theme} />
        <DetailRow label="Business Name" value={businessName} theme={theme} />
        <DetailRow label="Business Type" value={businessType} theme={theme} isLast />
      </View>

      {/* Logout Button (Only Situated Here) */}
      <Pressable
        accessibilityRole="button"
        onPress={onSignOut}
        style={[styles.logoutButton, { backgroundColor: theme.isDark ? theme.danger : theme.dangerBg, borderColor: theme.isDark ? theme.danger : theme.dangerBorder }]}
      >
        <Text style={[styles.logoutButtonText, { color: '#FFFFFF' }]}>Log Out</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  theme,
  isLast = false,
}: {
  label: string;
  value: string;
  theme: any;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <Text style={[styles.detailLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.ink }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userMobile: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  logoutButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
