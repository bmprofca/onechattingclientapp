import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiSession } from '../api/client';
import { getChatHistory, markAsRead, sendMessage, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { colors } from '../theme/theme';

export function ChatRoomScreen({
  projectId,
  session,
  contactNumber,
  contactName,
  onBack,
}: {
  projectId: string;
  session: ApiSession;
  contactNumber: string;
  contactName: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastId, setLastId] = useState<number | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const loadHistory = useCallback(
    async (loadMore = false) => {
      if (loading || (!hasMore && loadMore)) return;

      setLoading(true);
      if (!loadMore) setError('');

      try {
        const response = await getChatHistory(
          session,
          projectId,
          contactNumber,
          loadMore ? lastId : undefined,
        );

        const fetchedMessages = unwrapList(response);
        if (loadMore) {
          setMessages(prev => [...prev, ...fetchedMessages]);
        } else {
          setMessages(fetchedMessages);
        }

        if (response.last_id) {
          setLastId(response.last_id);
        }

        if (fetchedMessages.length === 0) {
          setHasMore(false);
        }

      } catch (requestError) {
        if (!loadMore) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not load messages.',
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [contactNumber, hasMore, lastId, loading, projectId, session],
  );

  useEffect(() => {
    loadHistory();
    // Mark as read when opening chat
    markAsRead(session, projectId, contactNumber).catch(() => { });
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await sendMessage(session, projectId, contactNumber, textToSend);
      setLastId(undefined);
      setHasMore(true);
      setMessages([]);
      await loadHistory(false);
    } catch (err) {
      console.warn('Failed to send message', err);
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isOut = item.type === 'out';
    const isRead = item.status === 'read';
    const isDelivered = item.status === 'delivered';

    return (
      <View style={[styles.messageRow, isOut ? styles.messageRowOut : styles.messageRowIn]}>
        <View style={[styles.messageBubble, isOut ? styles.messageBubbleOut : styles.messageBubbleIn]}>
          <Text style={[styles.messageText, isOut ? styles.messageTextOut : styles.messageTextIn]}>
            {item.message || '(Unsupported message type)'}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOut ? styles.messageTimeOut : styles.messageTimeIn]}>
              {new Date(item.create_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOut && (
              <Text style={[styles.messageStatusTicks, isRead ? styles.tickRead : isDelivered ? styles.tickDelivered : styles.tickPending]}>
                {isRead ? ' ✓✓' : isDelivered ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const initialLetter = (contactName || contactNumber || 'C').trim().charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* WhatsApp Style Top Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialLetter}</Text>
        </View>

        <View style={styles.headerTitleContainer}>
          <Text numberOfLines={1} style={styles.headerTitle}>{contactName}</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>{contactNumber}</Text>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>📞</Text>
          </Pressable>
          <Pressable style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>⋮</Text>
          </Pressable>
        </View>
      </View>

      {/* Message List area with WhatsApp background */}
      <View style={styles.chatBackground}>
        <FlatList
          data={messages}
          keyExtractor={item => String(item.id || item.message_id)}
          renderItem={renderMessage}
          inverted={true}
          contentContainerStyle={messages.length ? styles.listContent : styles.listContentEmpty}
          onEndReached={() => loadHistory(true)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <LoadState
                loading={loading}
                error={error}
                empty={!loading && !error && messages.length === 0}
                onRetry={() => loadHistory()}
              />
            </View>
          }
        />
      </View>

      {/* WhatsApp Style Input Bar */}
      <View style={styles.inputContainer}>
        <View style={styles.inputPill}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message"
            placeholderTextColor="#8696A0"
            multiline
          />
        </View>
        <Pressable
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Text style={styles.sendButtonIcon}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#075E54', // WhatsApp Teal status bar & header
  },
  container: {
    flex: 1,
    backgroundColor: '#E5DDD5', // WhatsApp Chat Wall Paper color
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffffd8',
  },
  backButton: {
    paddingRight: 8,
    paddingLeft: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#128C7E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',

  },
  headerSubtitle: {
    fontSize: 12,
    color: '#282626ff',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  headerIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  chatBackground: {
    flex: 1,
    backgroundColor: '#EFEAE2', // Classic WhatsApp chat background
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexGrow: 1,
  },
  listContentEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexGrow: 1,
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageRowIn: {
    justifyContent: 'flex-start',
  },
  messageRowOut: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1,
  },
  messageBubbleIn: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
  },
  messageBubbleOut: {
    backgroundColor: '#E7FFDB', // WhatsApp Light Green bubble
    borderTopRightRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextIn: {
    color: '#111B21',
  },
  messageTextOut: {
    color: '#111B21',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  messageTime: {
    fontSize: 11,
  },
  messageTimeIn: {
    color: '#667781',
  },
  messageTimeOut: {
    color: '#667781',
  },
  messageStatusTicks: {
    fontSize: 12,
    marginLeft: 3,
    fontWeight: '700',
  },
  tickRead: {
    color: '#34B7F1', // WhatsApp Blue tick
  },
  tickDelivered: {
    color: '#667781', // Gray tick
  },
  tickPending: {
    color: '#8696A0',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
  },
  inputPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 15,
    color: '#111B21',
    padding: 0,
  },
  sendButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#075E54', // WhatsApp Teal send button
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#8696A0',
  },
  sendButtonIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 2,
  },
});
