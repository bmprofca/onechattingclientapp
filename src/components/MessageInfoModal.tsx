import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

export function MessageInfoModal({
  message,
  chatName,
  onClose,
}: {
  message: any | null;
  chatName?: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [shown, setShown] = useState<any | null>(message);
  const anim = useRef(new Animated.Value(message ? 1 : 0)).current;

  useEffect(() => {
    if (message) {
      setShown(message);
      anim.stopAnimation();
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setShown(null);
    });
  }, [anim, message]);

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

  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const cardScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const cardShift = anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  return (
    <Modal visible={!!shown} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.dim, { opacity: backdropOpacity }]} />
        <Pressable style={styles.dismiss} onPress={onClose} />
        <Animated.View
          style={{
            width: '100%',
            opacity: backdropOpacity,
            transform: [{ translateY: cardShift }, { scale: cardScale }],
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

            <Pressable onPress={onClose} style={[styles.close, { backgroundColor: theme.emerald }]}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

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
    flex: 1,
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
