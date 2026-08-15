import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface PulseViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  minScale?: number;
  maxScale?: number;
  minOpacity?: number;
  maxOpacity?: number;
  duration?: number;
  active?: boolean;
}

export function PulseView({
  children,
  style,
  minScale = 0.95,
  maxScale = 1.05,
  minOpacity = 0.8,
  maxOpacity = 1,
  duration = 1200,
  active = true,
}: PulseViewProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      anim.setValue(0);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    return () => pulse.stop();
  }, [active, anim, duration]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [minScale, maxScale],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [minOpacity, maxOpacity],
  });

  return (
    <Animated.View
      style={[
        style,
        active && {
          transform: [{ scale }],
          opacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
