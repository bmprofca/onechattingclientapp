import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

export function SplashScreen() {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing loader dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeAnim, scaleAnim, dotAnim]);

  const dotOpacity = dotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const dotScale = dotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* App icon */}
        <View style={[styles.iconCircle, { backgroundColor: theme.emerald }]}>
          <Text style={styles.iconText}>1</Text>
        </View>

        {/* App name */}
        <Text style={[styles.appName, { color: theme.ink }]}>
          1chatting
        </Text>

        {/* Tagline */}
        <Text style={[styles.tagline, { color: theme.muted }]}>
          WhatsApp Business Messaging
        </Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[styles.loaderWrap, { opacity: fadeAnim }]}>
        {[0, 1, 2].map(i => {
          const delay = i * 260;
          return (
            <PulsingDot
              key={i}
              delay={delay}
              color={theme.emerald}
            />
          );
        })}
      </Animated.View>

      {/* Footer */}
      <Animated.Text
        style={[styles.footerText, { color: theme.muted, opacity: fadeAnim }]}
      >
        Powered by 1Chatting
      </Animated.Text>
    </View>
  );
}

function PulsingDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [anim, delay]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 1],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.15],
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  iconText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 20,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  loaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footerText: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
