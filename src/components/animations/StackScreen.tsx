import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';

export const STACK_ENTER_DURATION = 280;
export const STACK_EXIT_DURATION = 240;

/** Width of the left-edge strip that can start a swipe-back gesture. */
const EDGE_WIDTH = 24;
/** Max opacity of the black scrim drawn over the content underneath. */
const MAX_DIM = 0.18;

type Falsy = null | undefined | false;

interface StackScreenProps<T> {
  /**
   * The screen's target. Truthy → the screen is (or becomes) visible.
   * Falsy → the screen slides out and unmounts afterwards. While exiting,
   * the last truthy value is cached and passed to `children`, so the
   * screen never loses its data mid-animation.
   */
  item: T | Falsy;
  children: (item: T) => React.ReactNode;
  /** Called when the user completes a swipe-back gesture. */
  onRequestClose?: () => void;
  /** Interactive swipe from the left edge. Defaults to iOS only (Android
   * gesture navigation already maps the edge swipe to hardware back). */
  swipeToClose?: boolean;
  /** Positioning of the layer (defaults to absolute fill). */
  style?: StyleProp<ViewStyle>;
  /** Style of the sliding card, e.g. its background colour. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Stack-style push/pop transition for full-screen destinations rendered as
 * absolute overlays. Enter: slide in from the right; exit: slide back out
 * before unmounting. All animations run on the native driver.
 */
export function StackScreen<T>({
  item,
  children,
  onRequestClose,
  swipeToClose = Platform.OS === 'ios',
  style,
  contentStyle,
}: StackScreenProps<T>) {
  const { width } = useWindowDimensions();
  const visible = !!item;

  const cachedItem = useRef<T | null>(visible ? (item as T) : null);
  if (visible) cachedItem.current = item as T;

  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) {
    // Derived-state update during render: mount immediately on open.
    setRendered(true);
  }
  const [exiting, setExiting] = useState(false);

  const translateX = useRef(new Animated.Value(width)).current;
  const widthRef = useRef(width);
  widthRef.current = width;
  const shownRef = useRef(false);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const closedBySwipeRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;
  const swipeEnabledRef = useRef(false);
  swipeEnabledRef.current = swipeToClose && !!onRequestClose && visible;

  useEffect(() => {
    animRef.current?.stop();
    if (visible) {
      closedBySwipeRef.current = false;
      if (!shownRef.current) {
        translateX.setValue(widthRef.current);
        shownRef.current = true;
      }
      setExiting(false);
      const anim = Animated.timing(translateX, {
        toValue: 0,
        duration: STACK_ENTER_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animRef.current = anim;
      anim.start();
    } else if (shownRef.current) {
      setExiting(true);
      const anim = Animated.timing(translateX, {
        toValue: widthRef.current,
        // A completed swipe has already moved the card off-screen.
        duration: closedBySwipeRef.current ? 0 : STACK_EXIT_DURATION,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (!finished || visibleRef.current) return;
        shownRef.current = false;
        closedBySwipeRef.current = false;
        cachedItem.current = null;
        setExiting(false);
        setRendered(false);
      });
    }
  }, [visible, translateX]);

  useEffect(() => () => animRef.current?.stop(), []);

  const panResponder = useMemo(() => {
    const settle = (toValue: number, done?: () => void) => {
      const anim = Animated.timing(translateX, {
        toValue,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) done?.();
      });
    };
    return PanResponder.create({
      // Capture only gestures that start at the very left edge and are
      // clearly horizontal, so pagers/lists inside the screen keep working.
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        swipeEnabledRef.current &&
        g.x0 <= EDGE_WIDTH &&
        g.dx > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        animRef.current?.stop();
      },
      onPanResponderMove: (_e, g) => {
        translateX.setValue(Math.max(0, g.dx));
      },
      onPanResponderRelease: (_e, g) => {
        const w = widthRef.current;
        if (g.dx > w * 0.35 || (g.vx > 0.5 && g.dx > 0)) {
          closedBySwipeRef.current = true;
          settle(w, () => {
            if (visibleRef.current) onRequestCloseRef.current?.();
          });
        } else {
          settle(0);
        }
      },
      onPanResponderTerminate: () => settle(0),
    });
  }, [translateX]);

  if (!rendered || cachedItem.current === null) return null;

  const dim = translateX.interpolate({
    inputRange: [0, Math.max(1, width)],
    outputRange: [MAX_DIM, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.scrim, { opacity: dim }]}
      />
      <Animated.View
        pointerEvents={exiting ? 'none' : 'auto'}
        style={[
          StyleSheet.absoluteFill,
          styles.card,
          contentStyle,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        {children(cachedItem.current)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#000' },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
});
