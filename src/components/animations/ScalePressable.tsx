import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface ScalePressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  activeScale?: number;
  activeOpacity?: number;
  friction?: number;
  tension?: number;
}

export function ScalePressable({
  children,
  style,
  activeScale = 0.96,
  activeOpacity = 0.9,
  friction = 7,
  tension = 50,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ScalePressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: any) => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: activeScale,
        friction,
        tension,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: activeOpacity,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction,
        tension,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    onPressOut?.(event);
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {({ pressed }) => {
        const computedStyle = typeof style === 'function' ? style({ pressed }) : style;
        return (
          <Animated.View
            style={[
              computedStyle,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            {children}
          </Animated.View>
        );
      }}
    </Pressable>
  );
}
