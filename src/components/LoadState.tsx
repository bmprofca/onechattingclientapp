import React from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {colors, ui} from '../theme/theme';

export function LoadState({loading, error, empty, onRetry}: {loading: boolean; error?: string; empty: boolean; onRetry: () => void}) {
  if (loading) return <View style={ui.empty}><ActivityIndicator color={colors.emerald} /><Text style={[ui.emptyText, {marginTop: 12}]}>Loading from 1Chatting…</Text></View>;
  if (error) return <View style={ui.empty}><Text style={ui.emptyText}>{error}</Text><Pressable onPress={onRetry} style={[ui.button, {marginTop: 16, width: 130}]}><Text style={ui.buttonText}>Retry</Text></Pressable></View>;
  if (empty) return <View style={ui.empty}><Text style={ui.emptyText}>There is nothing to show yet.</Text></View>;
  return null;
}
