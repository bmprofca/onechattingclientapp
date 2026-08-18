import React from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export function KeyboardAvoidView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const keyboardHeightAnim = useKeyboardHeight();

  return (
    <Animated.View style={[{ flex: 1, paddingBottom: keyboardHeightAnim }, style]}>
      {children}
    </Animated.View>
  );
}
