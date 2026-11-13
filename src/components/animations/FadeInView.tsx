import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type FadeDirection = 'up' | 'down' | 'left' | 'right' | 'none';

interface FadeInViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  direction?: FadeDirection;
  distance?: number;
  scale?: boolean;
  startScale?: number;
}

export function FadeInView({
  children,
  style,
  delay = 0,
  duration = 350,
  direction = 'up',
  distance = 18,
  scale = false,
  startScale = 0.95,
}: FadeInViewProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(distance)).current;
  const scaleAnim = useRef(new Animated.Value(scale ? startScale : 1)).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ];

    if (scale) {
      animations.push(
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 45,
          useNativeDriver: true,
        }),
      );
    }

    const timer = setTimeout(() => {
      Animated.parallel(animations).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, distance, duration, opacityAnim, scale, scaleAnim, startScale, translateAnim]);

  const getTransform = () => {
    const transforms: any[] = [];
    if (direction === 'up') {
      transforms.push({ translateY: translateAnim });
    } else if (direction === 'down') {
      transforms.push({
        translateY: translateAnim.interpolate({
          inputRange: [0, distance],
          outputRange: [0, -distance],
        }),
      });
    } else if (direction === 'left') {
      transforms.push({ translateX: translateAnim });
    } else if (direction === 'right') {
      transforms.push({
        translateX: translateAnim.interpolate({
          inputRange: [0, distance],
          outputRange: [0, -distance],
        }),
      });
    }

    if (scale) {
      transforms.push({ scale: scaleAnim });
    }

    return transforms;
  };

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: opacityAnim,
          transform: getTransform(),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
