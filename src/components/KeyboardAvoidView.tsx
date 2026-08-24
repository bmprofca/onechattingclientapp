import React from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useKeyboardContext } from '../contexts/KeyboardContext';

export function KeyboardAvoidView({
  children,
  style,
  offset = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  offset?: number;
}) {
  const { keyboardHeightAnim } = useKeyboardContext();

  return (
    <Animated.View
      style={[
        { flex: 1 },
        style,
        {
          paddingBottom: Animated.add(keyboardHeightAnim, offset),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
