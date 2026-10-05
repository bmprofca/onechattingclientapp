import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { ScreenSkeleton } from './Skeleton';

export function LoadState({
  loading,
  error,
  empty,
  emptyTitle,
  emptyCopy,
  onRetry,
  skeleton = 'list',
}: {
  loading: boolean;
  error?: string;
  empty: boolean;
  emptyTitle?: string;
  emptyCopy?: string;
  onRetry: () => void;
  skeleton?: React.ComponentProps<typeof ScreenSkeleton>['variant'];
}) {
  const theme = useTheme();

  if (loading) return <ScreenSkeleton variant={skeleton} />;

  if (error)
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>{error}</Text>
        <Pressable
          onPress={onRetry}
          style={[styles.retryBtn, { backgroundColor: theme.emerald }]}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );

  if (empty)
    return (
      <View style={styles.empty}>
        {emptyTitle ? (
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>
            {emptyTitle}
          </Text>
        ) : null}
        <Text style={[styles.emptyText, { color: theme.muted, marginTop: emptyTitle ? 6 : 0 }]}>
          {emptyCopy || 'There is nothing to show yet.'}
        </Text>
      </View>
    );

  return null;
}

const styles = StyleSheet.create({
  empty: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  retryBtn: {
    height: 44,
    width: 140,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
