import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { FadeInView } from './FadeInView';

/** Consistent entrance animation for full-screen destinations. */
export function ScreenTransition({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FadeInView
      direction="right"
      distance={16}
      duration={260}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </FadeInView>
  );
}

/** Cell renderer for FlatList screens that need a staggered item entrance. */
export function StaggeredCell({children, index}: {children: React.ReactNode; index?: number}) {
  return (
    <FadeInView delay={Math.min((index ?? 0) * 35, 250)} distance={12} duration={280}>
      {children}
    </FadeInView>
  );
}
