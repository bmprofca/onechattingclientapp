import React from 'react';
import { Animated, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export function KeyboardAvoidView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const keyboardHeightAnim = useKeyboardHeight();

  // On Android, windowSoftInputMode="adjustResize" in AndroidManifest already
  // dynamically resizes the window with the user's keyboard.
  // Adding manual paddingBottom causes duplicate height padding (huge blank gap).
  if (Platform.OS === 'android') {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  return (
    <Animated.View style={[{ flex: 1, paddingBottom: keyboardHeightAnim }, style]}>
      {children}
    </Animated.View>
  );
}
