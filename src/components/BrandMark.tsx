import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

const logo = require('../assets/logo.png');

export function BrandMark({
  size = 40,
  color,
  subtitle,
}: {
  size?: number;
  color?: string;
  subtitle?: string;
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
      <View style={styles.copy}>
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
        {subtitle ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.subtitle, { color: theme.muted }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  copy: { flexShrink: 1 },
  name: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
});
