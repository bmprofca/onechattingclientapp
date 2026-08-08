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
import { ApiSession } from '../api/client';
import { getChatHistory, markAsRead, sendMessage, unwrapList } from '../api/workspace';
import { LoadState } from '../components/LoadState';
import { useTheme } from '../theme/theme';

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
  const theme = useTheme();
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
        <View style={[
          styles.messageBubble,
          isOut
            ? { backgroundColor: theme.bubbleOut, borderTopRightRadius: 2 }
            : { backgroundColor: theme.bubbleIn, borderTopLeftRadius: 2 },
        ]}>
          <Text style={[
            styles.messageText,
            { color: isOut ? theme.bubbleOutText : theme.bubbleInText },
          ]}>
            {item.message || '(Unsupported message type)'}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              { color: isOut ? theme.bubbleOutText + 'A0' : theme.muted },
            ]}>
              {new Date(item.create_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOut && (
              <Text style={[
                styles.messageStatusTicks,
                isRead ? styles.tickRead : isDelivered ? { color: theme.muted } : { color: theme.muted },
              ]}>
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
      style={[styles.container, { backgroundColor: theme.chatBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Sleek Top Header */}
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <Text style={[styles.backButtonText, { color: theme.ink }]}>‹</Text>
        </Pressable>

        <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
          <Text style={[styles.avatarText, { color: theme.mintText }]}>{initialLetter}</Text>
        </View>

        <View style={styles.headerTitleContainer}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink }]}>{contactName}</Text>
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: theme.muted }]}>{contactNumber}</Text>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable style={styles.headerIconBtn} hitSlop={8}>
            <Text style={[styles.headerIcon, { color: theme.ink }]}>⋮</Text>
          </Pressable>
        </View>
      </View>

      {/* Message List area */}
      <View style={[styles.chatBackground, { backgroundColor: theme.chatBg }]}>
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

      {/* Input Bar */}
      <View style={[styles.inputContainer, { backgroundColor: theme.inputContainerBg }]}>
        <View style={[styles.inputPill, { backgroundColor: theme.inputBg }]}>
          <TextInput
            style={[styles.textInput, { color: theme.ink }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message"
            placeholderTextColor={theme.muted}
            multiline
          />
        </View>
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: theme.emerald },
            (!inputText.trim() || sending) && { backgroundColor: theme.muted },
          ]}
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 40,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 22,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 36,
  },
  chatBackground: {
    flex: 1,
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
  messageText: {
    fontSize: 15,
    lineHeight: 20,
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
  messageStatusTicks: {
    fontSize: 12,
    marginLeft: 3,
    fontWeight: '700',
  },
  tickRead: {
    color: '#34B7F1',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  inputPill: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 15,
    padding: 0,
  },
  sendButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 2,
  },
});