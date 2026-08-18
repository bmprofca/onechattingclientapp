import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { MessageCircle, X, CornerDownLeft } from 'lucide-react-native';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';

export type NotificationPayload = {
  contactNumber: string;
  contactName: string;
  messageText: string;
  mediaType?: string;
  timestamp?: string | number;
};

export function WhatsAppNotificationBanner({
  currentChatNumber,
  onOpenChat,
}: {
  currentChatNumber?: string | null;
  onOpenChat: (contactNumber: string, contactName: string) => void;
}) {
  const theme = useTheme();
  const [notification, setNotification] = useState<NotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissNotification = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setNotification(null);
    });
  };

  const showNotification = (payload: NotificationPayload) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setNotification(payload);

    // Vibration pattern (WhatsApp style notification)
    try {
      Vibration.vibrate([0, 100, 60, 120]);
    } catch {
      // ignore
    }

    // Reset before animating in
    translateY.setValue(-150);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        bounciness: 6,
        speed: 14,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after 4.5 seconds
    timeoutRef.current = setTimeout(() => {
      dismissNotification();
    }, 4500);
  };

  useEffect(() => {
    const unsub = socketManager.onChat((data) => {
      if (!data) return;
      const msg = data.message || {};
      const contact = data.contact || {};

      // Only notify on incoming messages
      const isIncoming = msg.type === 'in' || msg.message_type === 'in' || msg.direction === 'in';
      if (!isIncoming) return;

      const contactNumber = String(contact.number || msg.number || msg.from || msg.contact_number || '');
      if (!contactNumber) return;

      // Don't show banner if user is already in this chat
      if (currentChatNumber && String(currentChatNumber) === contactNumber) {
        return;
      }

      const contactName = String(
        contact.name || contact.firm_name || msg.name || contactNumber,
      );

      // Determine display text
      let text = String(msg.message || msg.text || msg.body || '');
      const mediaType = msg.media_type || msg.type;
      if (!text && mediaType) {
        if (mediaType.includes('image')) text = '📷 Photo';
        else if (mediaType.includes('video')) text = '🎥 Video';
        else if (mediaType.includes('document') || mediaType.includes('pdf')) text = '📄 Document';
        else if (mediaType.includes('audio') || mediaType.includes('voice')) text = '🎵 Voice message';
        else text = '📎 Attachment';
      }

      showNotification({
        contactNumber,
        contactName,
        messageText: text || 'New message',
        mediaType,
        timestamp: msg.create_date || Date.now(),
      });
    });

    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentChatNumber]);

  if (!notification) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          const num = notification.contactNumber;
          const name = notification.contactName;
          dismissNotification();
          onOpenChat(num, name);
        }}
        style={[
          styles.banner,
          {
            backgroundColor: theme.isDark ? '#1F2C34' : '#FFFFFF',
            borderColor: theme.isDark ? '#2A3942' : '#E2E8F0',
            shadowColor: '#000000',
          },
        ]}
      >
        {/* Top bar info */}
        <View style={styles.topRow}>
          <View style={styles.appHeader}>
            <View style={[styles.waIconBox, { backgroundColor: '#25D366' }]}>
              <MessageCircle size={11} color="#FFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.appName, { color: theme.isDark ? '#8696A0' : '#64748B' }]}>
              1Chatting • WhatsApp
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.timeText, { color: theme.isDark ? '#8696A0' : '#94A3B8' }]}>
              now
            </Text>
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                dismissNotification();
              }}
              style={styles.closeBtn}
            >
              <X size={14} color={theme.isDark ? '#8696A0' : '#94A3B8'} />
            </Pressable>
          </View>
        </View>

        {/* Content row */}
        <View style={styles.contentRow}>
          <View style={[styles.avatar, { backgroundColor: theme.isDark ? '#005C4B' : '#E7F8F2' }]}>
            <Text style={[styles.avatarText, { color: theme.isDark ? '#25D366' : '#089748' }]}>
              {notification.contactName.trim().charAt(0).toUpperCase() || 'C'}
            </Text>
          </View>

          <View style={styles.textContainer}>
            <Text numberOfLines={1} style={[styles.senderName, { color: theme.isDark ? '#E9EDEF' : '#111B21' }]}>
              {notification.contactName}
            </Text>
            <Text numberOfLines={2} style={[styles.messageText, { color: theme.isDark ? '#8696A0' : '#475569' }]}>
              {notification.messageText}
            </Text>
          </View>

          {/* Quick Action Button */}
          <View style={[styles.replyPill, { backgroundColor: theme.isDark ? '#111B21' : '#F1F5F9' }]}>
            <CornerDownLeft size={12} color={theme.emerald} />
            <Text style={[styles.replyText, { color: theme.emerald }]}>Open</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waIconBox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 1,
  },
  replyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  replyText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
