import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface FadeScaleModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
  dismissOnBackdrop?: boolean;
}

export function FadeScaleModal({
  visible,
  onClose,
  children,
  contentStyle,
  containerStyle,
  backdropColor = 'rgba(0, 0, 0, 0.6)',
  dismissOnBackdrop = true,
}: FadeScaleModalProps) {
  const [modalVisible, setModalVisible] = useState(visible);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible, modalVisible, animValue]);

  const handleClose = () => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      onClose();
    });
  };

  if (!modalVisible) return null;

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, containerStyle]}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: backdropColor,
              opacity,
            },
          ]}
        >
          {dismissOnBackdrop && (
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            {
              opacity,
              transform: [{ scale }, { translateY }],
            },
            contentStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 16,
  },
});
