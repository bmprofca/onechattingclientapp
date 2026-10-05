import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { ConnectionStatus, socketManager } from '../services/socketManager';

const BAR_HEIGHT = 34;

function bannerCopy(status: ConnectionStatus) {
  if (status === 'connecting') return { label: 'Connecting...', color: '#F59E0B' };
  return { label: 'Waiting for network...', color: '#EF4444' };
}

export function ConnectionBanner() {
  const [status, setStatus] = useState<ConnectionStatus>(() => socketManager.getConnectionStatus());
  const shown = status !== 'connected';
  const [rendered, setRendered] = useState(shown);
  const copy = useRef(bannerCopy(status));
  if (shown) copy.current = bannerCopy(status);
  const progress = useRef(new Animated.Value(shown ? 1 : 0)).current;
  const run = useRef(0);

  useEffect(() => socketManager.onConnectionChange(setStatus), []);

  useEffect(() => {
    const id = ++run.current;
    if (shown) setRendered(true);
    Animated.timing(progress, {
      toValue: shown ? 1 : 0,
      duration: shown ? 240 : 220,
      easing: shown ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !shown && run.current === id) setRendered(false);
    });
  }, [progress, shown]);

  if (!rendered) return null;

  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_HEIGHT] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const shift = progress.interpolate({ inputRange: [0, 1], outputRange: [-BAR_HEIGHT, 0] });

  return (
    <Animated.View style={[styles.clip, { height, backgroundColor: copy.current.color }]}>
      <Animated.View style={[styles.bar, { opacity, transform: [{ translateY: shift }] }]}>
        <Text style={styles.label}>{copy.current.label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  bar: {
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
