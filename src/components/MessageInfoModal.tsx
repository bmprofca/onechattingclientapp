import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { useTheme } from '../theme/theme';

function parseServerDate(value: any): Date | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return new Date(value);
  const str = String(value).trim();
  const match = str.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
    );
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: any) {
  const date = parseServerDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function statusLabel(status?: string) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'read':
      return 'Read';
    case 'failed':
      return 'Failed';
    case 'received':
      return 'Received';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  }
}

function personName(message: any, role: 'send_by' | 'read_by') {
  const nested = message?.[role] || {};
  return String(message?.[`${role}_name`] || nested.name || nested.username || '').trim();
}

function personMobile(message: any, role: 'send_by' | 'read_by') {
  const nested = message?.[role] || {};
  return String(message?.[`${role}_mobile`] || nested.mobile || '').trim();
}

export type MessageInfoHandle = {
  open: (message: any) => void;
};

export const MessageInfoModal = forwardRef<MessageInfoHandle, { chatName?: string }>(
  function MessageInfoModal({ chatName }, ref) {
    const theme = useTheme();
    const [shown, setShown] = useState<any | null>(null);
    const anim = useRef(new Animated.Value(0)).current;
    const closing = useRef(false);
    const shift = useMemo(
      () => anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
      [anim],
    );

    const close = () => {
      if (closing.current) return;
      closing.current = true;
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        closing.current = false;
        if (finished) setShown(null);
      });
    };

    useImperativeHandle(ref, () => ({
      open(message: any) {
        closing.current = false;
        anim.stopAnimation();
        anim.setValue(0);
        setShown(message);
      },
    }), [anim]);

    useEffect(() => {
      if (!shown) return;
      const animation = Animated.timing(anim, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      animation.start();
      const back = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => {
        animation.stop();
        back.remove();
      };
    }, [anim, shown]);

    if (!shown) return null;

    const sentBy = personName(shown, 'send_by');
    const sentMobile = personMobile(shown, 'send_by');
    const readBy = personName(shown, 'read_by');
    const readMobile = personMobile(shown, 'read_by');
    const outgoing = shown?.type === 'out';
    const status = String(shown?.status || '');
    const statusColor =
      status === 'failed'
        ? '#E5484D'
        : status === 'read'
          ? '#12A150'
          : status === 'delivered'
            ? '#2563EB'
            : theme.muted;

    return (
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Animated.View style={[styles.dim, { opacity: anim }]} />
        <Pressable style={styles.dismiss} onPress={close} />
        <Animated.View
          style={{
            width: '100%',
            opacity: anim,
            transform: [{ translateY: shift }],
          }}
        >
          <Pressable
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => {}}
          >
            <View style={styles.titleRow}>
              <Info size={20} color={theme.emerald} />
              <Text style={[styles.title, { color: theme.ink }]}>Message Details</Text>
            </View>

            {outgoing && (sentBy || sentMobile) ? (
              <DetailRow label="Sent by" value={sentBy || sentMobile} hint={sentBy ? sentMobile : ''} theme={theme} />
            ) : null}
            {!outgoing && (readBy || readMobile) ? (
              <DetailRow label="Read by" value={readBy || readMobile} hint={readBy ? readMobile : ''} theme={theme} />
            ) : null}
            <DetailRow label="Direction" value={outgoing ? 'Outgoing' : 'Incoming'} theme={theme} />
            {outgoing && status ? (
              <DetailRow label="Status" value={statusLabel(status)} valueColor={statusColor} theme={theme} />
            ) : null}
            <DetailRow
              label="Timestamp"
              value={formatDateTime(shown?.timestamp || shown?.create_date)}
              theme={theme}
            />
            <DetailRow label="Chat" value={chatName || 'Unknown'} theme={theme} />
            {shown?.failed_reason ? (
              <DetailRow label="Error" value={String(shown.failed_reason)} valueColor="#E5484D" theme={theme} />
            ) : null}

            <Pressable onPress={close} style={[styles.close, { backgroundColor: theme.emerald }]}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </View>
    );
  },
);

function DetailRow({
  label,
  value,
  hint,
  valueColor,
  theme,
}: {
  label: string;
  value: string;
  hint?: string;
  valueColor?: string;
  theme: { ink: string; muted: string; border: string };
}) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <View style={styles.valueWrap}>
        <Text style={[styles.value, { color: valueColor || theme.ink }]}>{value}</Text>
        {hint ? <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    elevation: 40,
    justifyContent: 'center',
    padding: 24,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dismiss: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13, fontWeight: '700', paddingTop: 1 },
  valueWrap: { flex: 1, alignItems: 'flex-end' },
  value: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  hint: { fontSize: 12, marginTop: 2, textAlign: 'right' },
  close: {
    alignSelf: 'flex-end',
    marginTop: 16,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFF', fontWeight: '800' },
});
