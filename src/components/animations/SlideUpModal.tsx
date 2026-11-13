import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SlideUpModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
  maxHeight?: number | `${number}%`;
  dismissOnBackdrop?: boolean;
}

type SheetDragHandleProps = {
  onDismiss: () => void;
  onDrag?: (distance: number) => void;
};

export function SheetDragHandle({ onDismiss, onDrag }: SheetDragHandleProps) {
  const onDismissRef = useRef(onDismiss);
  const onDragRef = useRef(onDrag);
  onDismissRef.current = onDismiss;
  onDragRef.current = onDrag;

  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      gesture.dy > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) =>
      onDragRef.current?.(Math.max(gesture.dy, 0)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 64 || gesture.vy > 0.8) {
        onDismissRef.current();
      } else {
        onDragRef.current?.(0);
      }
    },
    onPanResponderTerminate: () => onDragRef.current?.(0),
  })).current;

  return (
    <View
      {...responder.panHandlers}
      accessibilityLabel="Drag down to close"
      style={styles.dragHandleTouch}
    >
      <View style={styles.dragHandle} />
    </View>
  );
}

export function DismissibleSheet({
  visible,
  onDismiss,
  children,
  style,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [dragY, visible]);

  const handleDrag = (distance: number) => {
    if (distance > 0) {
      dragY.setValue(distance);
    } else {
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
    }
  };

  return (
    <Animated.View style={[style, { transform: [{ translateY: dragY }] }]}>
      <SheetDragHandle onDismiss={onDismiss} onDrag={handleDrag} />
      {children}
    </Animated.View>
  );
}

export function SlideUpModal({
  visible,
  onClose,
  children,
  contentStyle,
  containerStyle,
  backdropColor = 'rgba(0, 0, 0, 0.55)',
  maxHeight = '85%',
  dismissOnBackdrop = true,
}: SlideUpModalProps) {
  const [modalVisible, setModalVisible] = useState(visible);
  const animValue = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const handleDrag = (distance: number) => {
    if (distance > 0) {
      dragY.setValue(distance);
    } else {
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
    }
  };

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    } else if (modalVisible) {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible, modalVisible, animValue, dragY]);

  const handleClose = () => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setModalVisible(false);
      onClose();
    });
  };

  if (!modalVisible) return null;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.6, 0],
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
              opacity: backdropOpacity,
            },
          ]}
        >
          {dismissOnBackdrop && (
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight,
              transform: [{ translateY: Animated.add(translateY, dragY) }],
            },
            contentStyle,
          ]}
        >
          <SheetDragHandle onDismiss={handleClose} onDrag={handleDrag} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandleTouch: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120, 130, 140, 0.65)',
  },
});
