import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, AtSign, Briefcase, Building2, FolderKanban, LogOut, Mail, Moon, Phone, Smartphone, Sun, Tag, User, UserRound, Wallet } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getAccountProfile } from '../api/auth';
import { Session } from '../services/session';
import { LoadState } from '../components/LoadState';
import { ScreenSkeleton } from '../components/Skeleton';
import { ThemeColors, ThemeMode, useTheme, useThemeMode } from '../theme/theme';

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
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
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
  // country_code may arrive as "91" or "+91", and some accounts store the
  // mobile with its code already — normalise so we never print "++91".
  const rawMobile = String(profile.mobile || '').trim();
  const dialCode = String(profile.country_code || '91').trim().replace(/^\++/, '');
  const mobile = !rawMobile
    ? 'No mobile specified'
    : rawMobile.startsWith('+')
      ? rawMobile
      : `+${dialCode} ${rawMobile}`;
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
          <Pressable onPress={onBack} style={[styles.backButton, { backgroundColor: theme.fieldBg }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.ink} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.ink }]}>Profile</Text>
          <View style={{ width: 38 }} />
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
        {loading ? <ScreenSkeleton variant="profile" /> : error ? (
          <LoadState loading={false} error={error} empty={false} onRetry={loadProfile} />
        ) : (
        <>
          {/* Identity card */}
          <View style={[styles.identityCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {profileImgUrl && !imgError ? (
              <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
                <Image
                  source={{ uri: profileImgUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => setImgError(true)}
                />
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
                <Text style={[styles.avatarText, { color: theme.mintText }]}>{initial}</Text>
              </View>
            )}
            <View style={styles.identityCopy}>
              <Text style={[styles.userName, { color: theme.ink }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.userMeta, { color: theme.muted }]} numberOfLines={1}>{email}</Text>
              <Text style={[styles.userMeta, { color: theme.muted }]} numberOfLines={1}>{mobile}</Text>
            </View>
          </View>

          {/* Account overview */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>Account</Text>
          <View style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <DetailRow icon={Wallet} tint={{ bg: theme.mint, fg: theme.mintText }} label="Wallet balance" value={`₹${balance}`} theme={theme} />
            <DetailRow icon={FolderKanban} tint={{ bg: theme.infoBg, fg: theme.info }} label="Total projects" value={String(projectCount)} theme={theme} isLast />
          </View>

          {/* Personal information */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>Personal information</Text>
          <View style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <DetailRow icon={User} tint={{ bg: theme.mint, fg: theme.mintText }} label="Full name" value={name} theme={theme} />
            <DetailRow icon={Mail} tint={{ bg: theme.infoBg, fg: theme.info }} label="Email address" value={email} theme={theme} />
            <DetailRow icon={Phone} tint={{ bg: theme.mint, fg: theme.mintText }} label="Mobile number" value={mobile} theme={theme} />
            <DetailRow icon={UserRound} tint={{ bg: theme.violetBg, fg: theme.violet }} label="Gender" value={gender} theme={theme} />
            <DetailRow icon={AtSign} tint={{ bg: theme.warnBg, fg: theme.warning }} label="Username ID" value={username} theme={theme} isLast />
          </View>

          {/* Business information */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>Business information</Text>
          <View style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <DetailRow icon={Briefcase} tint={{ bg: theme.infoBg, fg: theme.info }} label="Firm name" value={firmName} theme={theme} />
            <DetailRow icon={Building2} tint={{ bg: theme.violetBg, fg: theme.violet }} label="Business name" value={businessName} theme={theme} />
            <DetailRow icon={Tag} tint={{ bg: theme.warnBg, fg: theme.warning }} label="Business type" value={businessType} theme={theme} isLast />
          </View>

          {/* Appearance */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>Appearance</Text>
          <View style={[styles.groupCard, styles.appearanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View
              accessibilityRole="radiogroup"
              style={[styles.segmentTrack, { backgroundColor: theme.fieldBg }]}
            >
              {THEME_OPTIONS.map(option => {
                const active = themeMode === option.value;
                const Icon = option.icon;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${option.label} theme`}
                    onPress={() => setThemeMode(option.value)}
                    style={[
                      styles.segment,
                      active && [styles.segmentActive, { backgroundColor: theme.surface, shadowColor: theme.shadow }],
                    ]}
                  >
                    <Icon size={16} color={active ? theme.ink : theme.muted} strokeWidth={2.25} />
                    <Text style={[styles.segmentText, { color: active ? theme.ink : theme.muted }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Log out */}
          <Pressable
            accessibilityRole="button"
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.logoutButton,
              { backgroundColor: pressed ? theme.dangerBg : theme.surface, borderColor: theme.dangerBorder },
            ]}
          >
            <LogOut size={18} color={theme.danger} strokeWidth={2.25} />
            <Text style={[styles.logoutButtonText, { color: theme.danger }]}>Log out</Text>
          </Pressable>
        </>
        )}
      </ScrollView>
    </View>
  );
}

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { value: 'system', label: 'System', icon: Smartphone },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function DetailRow({
  icon: Icon,
  tint,
  label,
  value,
  theme,
  isLast = false,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tint: { bg: string; fg: string };
  label: string;
  value: string;
  theme: ThemeColors;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}>
      <View style={[styles.iconTile, { backgroundColor: tint.bg }]}>
        <Icon size={16} color={tint.fg} strokeWidth={2.25} />
      </View>
      <Text style={[styles.detailLabel, { color: theme.ink }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.muted }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  identityCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  userMeta: {
    fontSize: 13,
    marginTop: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    gap: 12,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  appearanceCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
  },
  segmentActive: {
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    borderWidth: 1,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
