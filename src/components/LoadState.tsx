import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

export function LoadState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error?: string;
  empty: boolean;
  onRetry: () => void;
}) {
  const theme = useTheme();

  if (loading)
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={theme.emerald} size="large" />
        <Text style={[styles.emptyText, { color: theme.muted, marginTop: 12 }]}>
          Loading from 1chatting…
        </Text>
      </View>
    );

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
        <Text style={[styles.emptyText, { color: theme.muted }]}>
          There is nothing to show yet.
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
