import React, { useState, useEffect } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { formatImageUrl } from '../utils/imageUrl';
import { useTheme } from '../theme/theme';

interface ProjectAvatarProps {
  name?: string;
  image?: string | null;
  size?: number;
  borderRadius?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function ProjectAvatar({
  name = 'P',
  image,
  size = 45,
  borderRadius,
  fontSize,
  style,
  imageStyle,
}: ProjectAvatarProps) {
  const theme = useTheme();
  const [loadError, setLoadError] = useState(false);
  const formattedUrl = formatImageUrl(image);

  useEffect(() => {
    setLoadError(false);
  }, [image]);

  const radius = borderRadius !== undefined ? borderRadius : Math.round(size * 0.31);
  const computedFontSize = fontSize || Math.max(12, Math.round(size * 0.4));
  const initial = (name || 'P').trim().charAt(0).toUpperCase() || 'P';

  if (formattedUrl && !loadError) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: theme.surface,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: formattedUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
            imageStyle,
          ]}
          resizeMode="cover"
          onError={() => setLoadError(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.mint,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initialText,
          {
            color: theme.mintText,
            fontSize: computedFontSize,
          },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontWeight: '900',
    textAlign: 'center',
  },
});
