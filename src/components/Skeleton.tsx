import React, { useEffect } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme';

const pulse = new Animated.Value(0.45);
let pulseStarted = false;

function ensurePulse() {
  if (pulseStarted) return;
  pulseStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: false }),
    ]),
  ).start();
}

export function Bone({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  useEffect(() => {
    ensurePulse();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.isDark ? '#2A3942' : '#E4EBEE',
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

function ListRows({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.listStack}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.listRow}>
          <Bone width={44} height={44} radius={14} />
          <View style={styles.lines}>
            <View style={styles.lineHead}>
              <Bone width={index % 2 === 0 ? '54%' : '42%'} height={15} />
              <Bone width={36} height={11} />
            </View>
            <Bone width={index % 2 === 0 ? '86%' : '70%'} height={13} style={{ marginTop: 6 }} />
            <Bone width={index % 3 === 0 ? '48%' : '34%'} height={10} style={{ marginTop: 6 }} />
          </View>
          <Bone width={8} height={18} radius={3} />
        </View>
      ))}
    </View>
  );
}

function CardRows({ count = 6 }: { count?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.listStack}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Bone width={38} height={38} radius={12} />
          <View style={styles.lines}>
            <Bone width={index % 2 === 0 ? '62%' : '46%'} height={14} />
            <Bone width="30%" height={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ScreenSkeleton({
  variant = 'list',
}: {
  variant?:
    | 'list'
    | 'chat'
    | 'case'
    | 'contact'
    | 'card'
    | 'transaction'
    | 'message'
    | 'dashboard'
    | 'profile'
    | 'form'
    | 'detail'
    | 'wallet'
    | 'project';
}) {
  const theme = useTheme();

  if (variant === 'chat' || variant === 'list' || variant === 'case' || variant === 'contact') {
    return <ListRows />;
  }
  if (variant === 'card') {
    return <CardRows />;
  }
  if (variant === 'transaction') {
    return (
      <View style={styles.stack}>
        {Array.from({ length: 8 }, (_, index) => (
          <Row key={index}>
            <View style={styles.lines}>
              <Bone width="50%" height={14} />
              <Bone width="32%" height={11} style={{ marginTop: 8 }} />
            </View>
            <Bone width={72} height={16} />
          </Row>
        ))}
      </View>
    );
  }
  if (variant === 'message') {
    return (
      <View style={[styles.messageWrap, { backgroundColor: 'transparent' }]}>
        {Array.from({ length: 6 }, (_, index) => {
          const mine = index % 2 === 1;
          return (
            <View key={index} style={[styles.bubbleRow, mine ? styles.bubbleRight : styles.bubbleLeft]}>
              <Bone width={mine ? 180 : 210} height={index % 3 === 0 ? 54 : 36} radius={16} />
            </View>
          );
        })}
      </View>
    );
  }
  if (variant === 'dashboard') {
    return (
      <View>
        <View style={[styles.wallet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Bone width="58%" height={10} />
          <Bone width="46%" height={28} radius={8} style={{ marginTop: 12 }} />
          <Bone width="92%" height={12} style={{ marginTop: 12 }} />
        </View>
        <View style={styles.metrics}>
          {Array.from({ length: 9 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.metricWrap,
                index % 2 === 0 ? styles.metricGap : null,
              ]}
            >
              <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Bone width={index % 3 === 0 ? 36 : 54} height={23} radius={6} />
                <Bone width={index % 2 === 0 ? '68%' : '52%'} height={11} style={{ marginTop: 8 }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (variant === 'profile') {
    return (
      <View style={styles.pad}>
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Bone width={84} height={84} radius={42} />
          <Bone width={140} height={16} style={{ marginTop: 14 }} />
          <Bone width={100} height={12} style={{ marginTop: 8 }} />
        </View>
        {Array.from({ length: 5 }, (_, index) => (
          <View key={index} style={{ marginTop: 14 }}>
            <Bone width={90} height={11} />
            <Bone height={48} radius={12} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    );
  }
  if (variant === 'form' || variant === 'detail') {
    return (
      <View style={styles.pad}>
        <Bone height={88} radius={18} />
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={{ marginTop: 16 }}>
            <Bone width={110} height={11} />
            <Bone height={46} radius={12} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    );
  }
  if (variant === 'wallet') {
    return (
      <View style={styles.pad}>
        <Bone height={120} radius={20} />
        <View style={styles.chips}>
          {Array.from({ length: 4 }, (_, index) => (
            <Bone key={index} width={72} height={36} radius={18} />
          ))}
        </View>
        <CardRows count={4} />
      </View>
    );
  }
  return (
    <View style={styles.pad}>
      <Bone height={46} radius={14} />
      <View style={[styles.chips, { marginTop: 16 }]}>
        {Array.from({ length: 3 }, (_, index) => (
          <View key={index} style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Bone width={40} height={11} />
            <Bone width={28} height={20} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
      <View style={{ marginTop: 8 }}>
        <CardRows count={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  listStack: { paddingTop: 8, gap: 10 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 12,
  },
  lineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wallet: {
    marginTop: 10,
    borderRadius: 21,
    borderWidth: 1,
    padding: 20,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  metricWrap: { width: '48.5%', marginBottom: 10 },
  metricGap: { marginRight: '3%' },
  metric: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 15,
  },
  row: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lines: { flex: 1 },
  pad: { paddingHorizontal: 16, paddingTop: 16 },
  hero: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 24,
  },
  chips: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  messageWrap: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
});
