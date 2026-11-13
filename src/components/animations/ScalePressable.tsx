import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';

// Layout keys that size/position the touch target inside its parent. They
// must live on the outer Pressable — if only the inner Animated.View had
// `flex: 1`, the Pressable would shrink to its content and rows of
// equal-width buttons (wallet presets, tab bars) would collapse.
const OUTER_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
] as const;

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = { ...flat };
  let movedFlex = false;
  for (const key of OUTER_KEYS) {
    if (key in flat) {
      outer[key] = flat[key];
      if (key.startsWith('margin') || key === 'alignSelf') delete inner[key];
      else movedFlex = true;
    }
  }
  // Percentage sizes must resolve against the real parent, not the
  // Pressable wrapper (which sizes itself to its child → collapses).
  for (const key of ['width', 'maxWidth', 'minWidth'] as const) {
    const v = flat[key];
    if (typeof v === 'string' && v.endsWith('%')) {
      outer[key] = v;
      inner[key] = key === 'minWidth' ? undefined : '100%';
    }
  }
  if (movedFlex) {
    // Inner view fills the now-sized Pressable.
    delete inner.flexBasis;
    inner.flexGrow = 1;
    inner.flexShrink = 1;
    delete inner.flex;
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

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
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: activeOpacity,
        duration: 100,
        useNativeDriver: false,
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
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
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
      style={({ pressed }) =>
        splitStyle(typeof style === 'function' ? style({ pressed }) : style).outer
      }
    >
      {({ pressed }) => {
        const computedStyle = splitStyle(
          typeof style === 'function' ? style({ pressed }) : style,
        ).inner;
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
