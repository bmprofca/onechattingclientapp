import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

const logo = require('../assets/logo.png');

export function BrandMark({
  size = 40,
  color,
}: {
  size?: number;
  color?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Image
        source={logo}
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
        }}
      />
      <Text
        style={[
          styles.name,
          {
            color: color || (theme.isDark ? '#ffffff' : theme.mintText),
            fontSize: Math.max(18, Math.round(size * 0.55)),
          },
        ]}
      >
        OneChatting
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
