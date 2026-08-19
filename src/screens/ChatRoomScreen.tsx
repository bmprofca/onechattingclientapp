import React, { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import Svg, { Circle, G, Path, Pattern, Rect } from 'react-native-svg';
import {
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Info,
  Plus,
  X,
  Reply,
  CornerUpLeft,
  MoreVertical,
  UserPlus,
  UserCheck,
  CheckCircle2,
  Briefcase,
  Edit2,
} from 'lucide-react-native';
import {
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {
  pick,
  types as DocumentPickerTypes,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { ApiSession } from '../api/client';
import {
  getChatHistory,
  markAsRead,
  sendMessage,
  sendImageMessage,
  sendVideoMessage,
  sendDocumentMessage,
  sendAudioMessage,
  sendTemplate,
  unwrapList,
  changeChatAssignment,
  getOpenCaseCount,
  getCaseList,
  createCase,
  editCase,
} from '../api/workspace';
import { uploadFile, PickedFile } from '../api/upload';
import { LoadState } from '../components/LoadState';
import { TemplateModal } from '../components/TemplateModal';
import { MediaViewerModal } from '../components/MediaViewerModal';
import { resolveTemplateBodyText, getTemplateHeaderMedia } from '../utils/templateUtils';
import { useTheme } from '../theme/theme';
import { socketManager } from '../services/socketManager';
import { Image as ImageIcon, Video, FileText, Music, LayoutTemplate } from 'lucide-react-native';
import { ScalePressable, FadeInView } from '../components/animations';
type AttachmentKind = 'photo' | 'video' | 'document' | 'audio';

type PendingAttachment = {
  kind: AttachmentKind;
  file: PickedFile;
};

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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<AttachmentKind | null>(null);
  // NEW: holds a picked-but-not-yet-sent attachment, shown as a preview above the input bar
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);

  // Media viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerType, setViewerType] = useState<'image' | 'video' | 'document' | 'audio'>('image');
  const [viewerName, setViewerName] = useState('');

  const openMediaViewer = (url: string, type: 'image' | 'video' | 'document' | 'audio', name?: string) => {
    setViewerUrl(url);
    setViewerType(type);
    setViewerName(name || '');
    setViewerVisible(true);
  };

  // Reply state
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  // ── Chat assign + case status/menu state (mirrors the web app) ─────────
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignmentInfo, setAssignmentInfo] = useState<any>(null);
  const [assignActionLoading, setAssignActionLoading] = useState(false);

  const [caseStatus, setCaseStatus] = useState<number | null>(null);
  const [caseStatusLoading, setCaseStatusLoading] = useState(false);
  const [caseListModalOpen, setCaseListModalOpen] = useState(false);
  const [caseList, setCaseList] = useState<any[]>([]);
  const [caseListLoading, setCaseListLoading] = useState(false);

  const [caseFormOpen, setCaseFormOpen] = useState(false);
  const [caseFormMode, setCaseFormMode] = useState<'create' | 'edit'>('create');
  const [caseFormRow, setCaseFormRow] = useState<any>(null);
  const [caseFormName, setCaseFormName] = useState('');
  const [caseFormRemark, setCaseFormRemark] = useState('');
  const [caseFormStatus, setCaseFormStatus] = useState<'open' | 'closed'>('open');
  const [caseFormSubmitting, setCaseFormSubmitting] = useState(false);

  const isAssigned = assignmentInfo?.assigned === true;
  const assignedUserName =
    assignmentInfo?.assigned_user?.name ||
    assignmentInfo?.assigned_user?.username ||
    assignmentInfo?.assigned_user?.mobile ||
    'Unassigned';
  const assignedUsername = assignmentInfo?.assigned_user?.username;
  const assignmentUsers: any[] = assignmentInfo?.users || [];

  // Keyboard height animation listener for flawless keypad avoidance on all Android & iOS devices
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 100,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 100,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeightAnim]);

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
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => String(m.id || m.message_id || m.wamid || m.unique_id)));
            const uniqueFetched = fetchedMessages.filter(m => !existingIds.has(String(m.id || m.message_id || m.wamid || m.unique_id)));
            return [...prev, ...uniqueFetched];
          });
        } else {
          const seen = new Set<string>();
          const uniqueFetched = fetchedMessages.filter(m => {
            const id = String(m.id || m.message_id || m.wamid || m.unique_id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setMessages(uniqueFetched);

          // Chat history responses carry current assignment info, same as the web app.
          if ((response as any)?.assigning) {
            setAssignmentInfo((response as any).assigning);
          }
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

  // Fetch open-case count whenever the chat changes, same as the web header badge.
  const fetchCaseStatus = useCallback(async () => {
    if (!contactNumber) return;
    setCaseStatusLoading(true);
    try {
      const res = await getOpenCaseCount(session, projectId, contactNumber);
      setCaseStatus(
        !res?.error && typeof res?.case_open_count === 'number'
          ? Math.max(0, res.case_open_count)
          : null,
      );
    } catch {
      setCaseStatus(null);
    } finally {
      setCaseStatusLoading(false);
    }
  }, [session, projectId, contactNumber]);

  useEffect(() => {
    fetchCaseStatus();
  }, [fetchCaseStatus]);

  useEffect(() => {
    const unsubChat = socketManager.onChat((data) => {
      if (data.contact?.number === contactNumber) {
        setMessages((prev) => {
          const msgId = data.message.message_id || data.message.unique_id;
          
          // Match exactly by ID
          const exactMatchIndex = prev.findIndex(m => (m.message_id && m.message_id === msgId) || (m.unique_id && m.unique_id === msgId) || m.id === data.message.id);
          if (exactMatchIndex !== -1) {
            const updated = [...prev];
            updated[exactMatchIndex] = { ...updated[exactMatchIndex], ...data.message, message_id: msgId };
            return updated;
          }

          // Fuzzy match for optimistic outgoing messages (text or template)
          if (data.message.type === 'out') {
            const candidateIndex = prev.findIndex(m =>
              m.type === 'out' &&
              String(m.id).startsWith('temp-') &&
              (m.status === 'pending' || m.status === 'sent') &&
              (
                (m.message_type === 'text' && data.message.message_type === 'text' && m.message === data.message.message) ||
                (m.message_type === 'template' && data.message.is_template)
              )
            );

            if (candidateIndex !== -1) {
              const updated = [...prev];
              updated[candidateIndex] = { ...updated[candidateIndex], ...data.message, message_id: msgId };
              return updated;
            }
          }

          const newMsg = { ...data.message, message_id: msgId };
          return [newMsg, ...prev];
        });

        if (data.message.type === 'in') {
          markAsRead(session, projectId, contactNumber).catch(() => { });
        }
      }
    });

    const unsubStatus = socketManager.onMessageStatus((data) => {
      setMessages((prev) =>
        prev.map(m => {
          if ((m.unique_id && m.unique_id === data.message_id) || (m.message_id && m.message_id === data.message_id) || m.id === data.last_id) {
            return { ...m, status: data.changes };
          }
          return m;
        })
      );
    });

    return () => {
      unsubChat();
      unsubStatus();
    };
  }, [contactNumber, projectId, session]);

  const refreshAfterSend = async () => {
    setLastId(undefined);
    setHasMore(true);
    setMessages([]);
    await loadHistory(false);
  };

  // ── Chat assign actions ─────────────────────────────────────────────
  const handleAssignChange = useCallback(
    async (type: 'assign' | 'unassign', target?: string) => {
      if (type === 'assign' && !target) {
        Toast.show({ type: 'error', text1: 'Choose a user to assign this chat to.' });
        return;
      }

      setAssignActionLoading(true);
      try {
        const res = await changeChatAssignment(session, projectId, contactNumber, type, target);
        if ((res as any)?.error) {
          throw new Error((res as any)?.message || 'Failed to update assignment.');
        }

        if ((res as any)?.assigning) {
          setAssignmentInfo((res as any).assigning);
        } else if (type === 'assign') {
          // Optimistically patch state if server didn't echo back assigning info
          setAssignmentInfo((prev: any) => ({
            ...prev,
            assigned: true,
            assigned_user: prev?.users?.find((u: any) => u.username === target) || { username: target },
          }));
        } else if (type === 'unassign') {
          setAssignmentInfo((prev: any) => ({ ...prev, assigned: false, assigned_to_me: false, assigned_user: null }));
        }

        // Re-sync assignment info from server to ensure accurate state
        try {
          const freshHistory = await getChatHistory(session, projectId, contactNumber, undefined);
          if ((freshHistory as any)?.assigning) {
            setAssignmentInfo((freshHistory as any).assigning);
          }
        } catch {
          // Non-critical: optimistic state already applied above
        }

        // Close the assign modal on success
        setAssignModalOpen(false);

        Toast.show({
          type: 'success',
          text1: type === 'assign' ? 'Chat assigned' : 'Chat unassigned',
        });
      } catch (err) {
        Toast.show({
          type: 'error',
          text1: 'Could not update assignment',
          text2: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setAssignActionLoading(false);
      }
    },
    [session, projectId, contactNumber],
  );

  const openAssignModal = useCallback(() => {
    setHeaderMenuOpen(false);
    setAssignModalOpen(true);
  }, []);

  // ── Case list / create / edit actions ───────────────────────────────
  const loadCaseList = useCallback(async () => {
    setCaseListLoading(true);
    try {
      const res = await getCaseList(session, projectId, { number: contactNumber, status: '' });
      setCaseList(!res?.error && Array.isArray(res?.data) ? res!.data! : []);
    } catch {
      setCaseList([]);
      Toast.show({ type: 'error', text1: 'Could not load cases' });
    } finally {
      setCaseListLoading(false);
    }
  }, [session, projectId, contactNumber]);

  const openCaseListModal = useCallback(() => {
    setHeaderMenuOpen(false);
    setCaseListModalOpen(true);
    loadCaseList();
  }, [loadCaseList]);

  const openCaseCreateForm = useCallback(() => {
    setCaseFormMode('create');
    setCaseFormRow(null);
    setCaseFormName('');
    setCaseFormRemark('');
    setCaseFormStatus('open');
    setCaseFormOpen(true);
  }, []);

  const openCaseEditForm = useCallback((row: any) => {
    setCaseFormMode('edit');
    setCaseFormRow(row);
    setCaseFormName(row?.name ?? '');
    setCaseFormRemark(row?.remark ?? '');
    setCaseFormStatus(row?.status === true || row?.status === '1' ? 'open' : 'closed');
    setCaseFormOpen(true);
  }, []);

  const submitCaseForm = useCallback(async () => {
    if (!caseFormName.trim()) {
      Toast.show({ type: 'error', text1: 'Case name is required' });
      return;
    }

    setCaseFormSubmitting(true);
    try {
      if (caseFormMode === 'create') {
        const res = await createCase(session, projectId, contactNumber, caseFormName, caseFormRemark, caseFormStatus);
        if ((res as any)?.error) throw new Error((res as any)?.error);
        Toast.show({ type: 'success', text1: 'Case created' });
      } else {
        const caseId = caseFormRow?.case_id ?? caseFormRow?.id;
        const res = await editCase(session, projectId, caseId, caseFormName, caseFormRemark, caseFormStatus);
        if ((res as any)?.error) throw new Error((res as any)?.error);
        Toast.show({ type: 'success', text1: 'Case updated' });
      }

      setCaseFormOpen(false);
      fetchCaseStatus();
      if (caseListModalOpen) loadCaseList();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: caseFormMode === 'create' ? 'Could not create case' : 'Could not update case',
        text2: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCaseFormSubmitting(false);
    }
  }, [
    caseFormMode,
    caseFormRow,
    caseFormName,
    caseFormRemark,
    caseFormStatus,
    session,
    projectId,
    contactNumber,
    caseListModalOpen,
    loadCaseList,
    fetchCaseStatus,
  ]);

  // Picks a file and stores it as a pending preview — does NOT upload or send yet.
  const handlePickAttachment = async (kind: AttachmentKind) => {
    setAttachMenuOpen(false);

    try {
      let picked: PickedFile | null = null;

      if (kind === 'photo' || kind === 'video') {
        const result: ImagePickerResponse = await launchImageLibrary({
          mediaType: kind === 'photo' ? 'photo' : 'video',
          selectionLimit: 1,
        });

        if (result.didCancel) return;
        if (result.errorMessage) throw new Error(result.errorMessage);

        const asset = result.assets?.[0];
        if (!asset?.uri) return;

        picked = {
          uri: asset.uri,
          name: asset.fileName || `${kind}-${Date.now()}`,
          type: asset.type || (kind === 'photo' ? 'image/jpeg' : 'video/mp4'),
        };
      } else {
        const docTypes =
          kind === 'audio' ? [DocumentPickerTypes.audio] : [DocumentPickerTypes.allFiles];

        const [result] = await pick({ type: docTypes });

        picked = {
          uri: result.uri,
          name: result.name || `${kind}-${Date.now()}`,
          type: result.type || 'application/octet-stream',
        };
      }

      if (!picked) return;

      setPendingAttachment({ kind, file: picked });
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      console.warn(`Failed to pick ${kind}`, err);

      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err);

      Toast.show({
        type: 'error',
        text1: `Could not select ${kind}`,
        text2: message,
        visibilityTime: 6000,
      });
    }
  };

  const cancelPendingAttachment = () => {
    setPendingAttachment(null);
  };

  // Uploads + sends whatever is currently pending. `caption` (if provided) is sent
  // as part of the SAME request for photo/video/document — the backend's
  // send-image/video/document routes accept a `message` field used as the caption.
  // Audio has no caption support on the backend, so it's ignored here and handled
  // separately as a follow-up text message in handleSend.
  const sendPendingAttachment = async (attachment: PendingAttachment, caption: string) => {
    const { kind, file } = attachment;
    setUploadingKind(kind);

    try {
      const uploaded = await uploadFile(file);

      switch (kind) {
        case 'photo':
          await sendImageMessage(session, projectId, contactNumber, uploaded.url, caption);
          break;
        case 'video':
          await sendVideoMessage(session, projectId, contactNumber, uploaded.url, caption);
          break;
        case 'document':
          await sendDocumentMessage(
            session,
            projectId,
            contactNumber,
            uploaded.url,
            uploaded.meta?.originalName || file.name,
            caption,
          );
          break;
        case 'audio':
          await sendAudioMessage(session, projectId, contactNumber, uploaded.url, false);
          break;
      }

      setPendingAttachment(null);
    } catch (err) {
      console.warn(`Failed to send ${kind}`, err);

      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err);

      Toast.show({
        type: 'error',
        text1: `Could not send ${kind}`,
        text2: message,
        visibilityTime: 6000,
      });
      // Keep the pending attachment so the user can retry instead of re-picking it.
    } finally {
      setUploadingKind(null);
    }
  };

  // Single send button now handles: attachment (if pending) first, then text.
  // For photo/video/document, typed text is sent as the caption on the SAME
  // request as the attachment (not a separate message). For audio (no caption
  // support server-side) and for text-only sends, it goes as its own message.
  const handleSend = async () => {
    if (sending || uploadingKind) return;

    const attachment = pendingAttachment;
    const hasAttachment = !!attachment;
    const textToSend = inputText.trim();

    if (!hasAttachment && !textToSend) return;

    const captionRidesWithAttachment = hasAttachment && attachment!.kind !== 'audio';

    setSending(true);
    try {
      if (hasAttachment) {
        const caption = captionRidesWithAttachment ? textToSend : '';
        await sendPendingAttachment(attachment as PendingAttachment, caption);
        if (captionRidesWithAttachment && textToSend) {
          setInputText('');
        }
      }

      // Only send a standalone text message when there's no attachment at all,
      // or the attachment was audio (which can't carry a caption).
      const shouldSendStandaloneText = textToSend && (!hasAttachment || !captionRidesWithAttachment);
      if (shouldSendStandaloneText) {
        setInputText('');

        // Capture reply info before clearing
        const currentReply = replyingTo;
        setReplyingTo(null);

        // Optimistic UI update
        const tempId = `temp-${Date.now()}`;
        setMessages((prev) => [
          {
            id: tempId,
            message_id: tempId,
            create_date: new Date().toISOString(),
            type: 'out',
            message_type: 'text',
            message: textToSend,
            status: 'pending',
            ...(currentReply ? {
              is_reply: true,
              reply_wamid: currentReply.wamid,
              reply_to_message: currentReply,
            } : {}),
          },
          ...prev,
        ]);

        try {
          const res = await sendMessage(session, projectId, contactNumber, textToSend, currentReply?.wamid);
          setMessages((prev) =>
            prev.map(m => m.id === tempId || m.message_id === tempId ? { ...m, ...res, status: res?.status || 'sent', message_id: res?.message_id || res?.data?.message_id || tempId } : m)
          );
        } catch (err) {
          console.warn('Failed to send message', err);

          // Revert optimistic message status to failed
          setMessages((prev) =>
            prev.map(m => m.id === tempId ? { ...m, status: 'failed', failed_reason: err instanceof Error ? err.message : String(err) } : m)
          );

          setInputText(textToSend);

          const message = err instanceof Error ? err.message : String(err);
          Toast.show({
            type: 'error',
            text1: 'Could not send message',
            text2: message,
            visibilityTime: 6000,
          });
        }
      }

      // No need to refreshAfterSend(), socket will echo the sent message back
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async (templateId: string, components: any[]) => {
    setTemplateMenuOpen(false);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      {
        id: tempId,
        message_id: tempId,
        create_date: new Date().toISOString(),
        type: 'out',
        message_type: 'template',
        message: 'Template sent',
        status: 'pending',
      },
      ...prev,
    ]);

    try {
      const res = await sendTemplate(session, projectId, contactNumber, templateId, components);
      setMessages((prev) =>
        prev.map(m => m.id === tempId || m.message_id === tempId ? { ...m, ...res, status: res?.status || 'sent', message_id: res?.message_id || res?.data?.message_id || tempId } : m)
      );
    } catch (err) {
      console.warn('Failed to send template', err);
      setMessages((prev) =>
        prev.map(m => m.id === tempId ? { ...m, status: 'failed', failed_reason: err instanceof Error ? err.message : String(err) } : m)
      );
      Toast.show({
        type: 'error',
        text1: 'Could not send template',
        text2: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Parses WhatsApp-style markup: *bold*, _italic_, ~strikethrough~
  function renderWhatsAppText(text: string, baseStyle: any): React.ReactNode {
    // Split on *...*, _..._, ~...~ markers
    const parts: Array<{ text: string; bold?: boolean; italic?: boolean; strike?: boolean }> = [];
    const regex = /(\*[^*]+\*)|(_[^_]+_)|(~[^~]+~)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index) });
      }
      const raw = match[0];
      if (raw.startsWith('*') && raw.endsWith('*')) {
        parts.push({ text: raw.slice(1, -1), bold: true });
      } else if (raw.startsWith('_') && raw.endsWith('_')) {
        parts.push({ text: raw.slice(1, -1), italic: true });
      } else if (raw.startsWith('~') && raw.endsWith('~')) {
        parts.push({ text: raw.slice(1, -1), strike: true });
      }
      lastIndex = match.index + raw.length;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex) });
    }

    // If no special markup found, return plain text
    if (parts.length === 1 && !parts[0].bold && !parts[0].italic && !parts[0].strike) {
      return <Text style={baseStyle}>{text}</Text>;
    }

    return (
      <Text style={baseStyle}>
        {parts.map((part, i) => {
          const extra: any = {};
          if (part.bold) extra.fontWeight = '700';
          if (part.italic) extra.fontStyle = 'italic';
          if (part.strike) extra.textDecorationLine = 'line-through';
          return (
            <Text key={i} style={extra}>
              {part.text}
            </Text>
          );
        })}
      </Text>
    );
  }

  const renderMessage = ({ item }: { item: any }) => {
    const isOut = item.type === 'out';
    const isRead = item.status === 'read';
    const isDelivered = item.status === 'delivered';
    const messageType = item.message_type || 'text';

    const canReply = Boolean(item.wamid && item.status !== 'failed');

    return (
      <FadeInView duration={220} distance={6}>
        <SwipeableMessageWrapper
          enabled={canReply}
          onSwipe={() => setReplyingTo(item)}
        >
          <Pressable
            onLongPress={() => {
              if (canReply) {
                setReplyingTo(item);
              }
            }}
            delayLongPress={400}
            style={[styles.messageRow, isOut ? styles.messageRowOut : styles.messageRowIn]}
          >
          {(() => {
            const templateMedia = getTemplateHeaderMedia(item);
            const isMediaMsg = (
              ((messageType === 'image' || messageType === 'video') && Boolean((item as any).media_url)) ||
              (templateMedia?.type === 'image' && Boolean(templateMedia?.url))
            );
            return (
              <View style={[
                styles.messageBubble,
                isOut
                  ? { backgroundColor: theme.bubbleOut, borderTopRightRadius: 2 }
                  : { backgroundColor: theme.bubbleIn, borderTopLeftRadius: 2 },
                isMediaMsg && styles.messageBubbleMedia,
              ]}>
                {renderReplyContext(item)}
                {renderMessageBody(item, messageType, isOut)}
                <View style={[styles.messageFooter, isMediaMsg && styles.messageFooterMedia]}>
                  <Text style={[
                    styles.messageTime,
                    { color: isOut ? theme.bubbleOutText + 'A0' : theme.muted },
                  ]}>
                    {new Date(item.create_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {isOut && (
                    <View style={{ marginLeft: 4, flexDirection: 'row', alignItems: 'center' }}>
                      {item.status === 'pending' && <Clock size={14} color={theme.muted} />}
                      {item.status === 'sent' && <Check size={16} color={theme.muted} />}
                      {item.status === 'delivered' && <CheckCheck size={16} color={theme.muted} />}
                      {item.status === 'read' && <CheckCheck size={16} color="#34B7F1" />}
                      {item.status === 'failed' && (
                        <ScalePressable
                          onPress={() => Alert.alert('Message Failed', item.failed_reason || 'Unknown error')}
                          hitSlop={8}
                          style={{ marginLeft: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <AlertCircle size={14} color="#EF4444" />
                          <Info size={14} color={theme.muted} />
                        </ScalePressable>
                      )}
                    </View>
                  )}
                  {canReply && (
                    <ScalePressable
                      onPress={() => setReplyingTo(item)}
                      hitSlop={12}
                      style={{ marginLeft: 6, opacity: 0.8 }}
                    >
                      <CornerUpLeft size={13} color={isOut ? theme.bubbleOutText + 'A0' : theme.muted} />
                    </ScalePressable>
                  )}
                </View>
              </View>
            );
          })()}
        </Pressable>
      </SwipeableMessageWrapper>
    </FadeInView>
    );

    function renderReplyContext(msg: any) {
      const replyMsg = msg.reply_to_message || (msg.is_reply && msg.reply_wamid ? messages.find(m => m.wamid === msg.reply_wamid) : null);
      if (!replyMsg) return null;

      const replyType = (replyMsg.message_type || 'text').toLowerCase();
      let replyPreview = replyMsg.message || '';
      if (replyType === 'image' || replyType === 'photo') replyPreview = replyMsg.message || '📷 Photo';
      else if (replyType === 'video') replyPreview = replyMsg.message || '🎥 Video';
      else if (replyType === 'document') replyPreview = replyMsg.media_name || '📄 Document';
      else if (replyType === 'audio') replyPreview = replyMsg.is_voice ? '🎤 Voice message' : '🎵 Audio';
      else if (replyType === 'template') replyPreview = resolveTemplateBodyText(replyMsg);

      return (
        <View style={[styles.replyContext, { borderLeftColor: theme.emerald }]}>
          <Text style={[styles.replyContextName, { color: theme.emerald }]}>
            {replyMsg.type === 'out' ? 'You' : (contactName || contactNumber)}
          </Text>
          <Text style={[styles.replyContextText, { color: theme.muted }]} numberOfLines={2}>
            {replyPreview}
          </Text>
        </View>
      );
    }

    function renderMessageBody(msg: any, type: string, out: boolean) {
      const textColor = out ? theme.bubbleOutText : theme.bubbleInText;

      const templateMedia = (type === 'template' || msg.template) ? getTemplateHeaderMedia(msg) : null;

      const textContent = (type === 'template' || msg.template)
        ? resolveTemplateBodyText(msg)
        : (msg.message || '');

      const baseTextStyle = [styles.messageText, { color: textColor }];

      const caption = textContent ? (
        <View style={styles.captionPad}>
          {renderWhatsAppText(textContent, [styles.messageText, { color: textColor, marginTop: templateMedia || (type !== 'text' && type !== 'template') ? 6 : 0 }])}
        </View>
      ) : null;

      const isDoc = type === 'document' || templateMedia?.type === 'document';
      const isImg = type === 'image' || templateMedia?.type === 'image';
      const isVid = type === 'video' || templateMedia?.type === 'video';

      const mediaUrl = templateMedia?.url || msg.media_url;
      const mediaName = templateMedia?.filename || msg.media_name || 'Document';

      if (isImg && mediaUrl) {
        return (
          <>
            <Pressable onPress={() => openMediaViewer(mediaUrl, 'image', mediaName)}>
              <Image source={{ uri: mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
            </Pressable>
            {textContent ? (
              <View style={styles.captionPad}>
                {renderWhatsAppText(textContent, [styles.messageText, { color: textColor, marginTop: 4 }])}
              </View>
            ) : null}
          </>
        );
      }

      if (isVid && mediaUrl) {
        return (
          <>
            <Pressable onPress={() => openMediaViewer(mediaUrl, 'video', mediaName)} style={styles.mediaPlaceholder}>
              <Text style={styles.mediaPlaceholderIcon}>▶</Text>
              <Text style={[styles.mediaPlaceholderLabel, { color: textColor }]}>Video</Text>
            </Pressable>
            {textContent ? (
              <View style={styles.captionPad}>
                {renderWhatsAppText(textContent, [styles.messageText, { color: textColor, marginTop: 4 }])}
              </View>
            ) : null}
          </>
        );
      }

      if (isDoc) {
        return (
          <>
            <Pressable onPress={() => openMediaViewer(mediaUrl || '', 'document', mediaName)} style={styles.documentCard}>
              <Text style={styles.documentIcon}>📄</Text>
              <Text style={[styles.documentName, { color: textColor }]} numberOfLines={2}>
                {mediaName}
              </Text>
            </Pressable>
            {caption}
          </>
        );
      }

      if (type === 'audio') {
        return (
          <Pressable onPress={() => openMediaViewer(msg.media_url || '', 'audio', msg.media_name)} style={styles.audioRow}>
            <Text style={styles.audioIcon}>{msg.is_voice ? '🎤' : '🎵'}</Text>
            <Text style={[styles.messageText, { color: textColor }]}>
              {msg.is_voice ? 'Voice message' : 'Audio'}
            </Text>
          </Pressable>
        );
      }

      if (textContent) {
        return renderWhatsAppText(textContent, baseTextStyle);
      }

      return (
        <Text style={[styles.messageText, { color: textColor }]}>
          (Unsupported message type)
        </Text>
      );
    }
  };

  const initialLetter = (contactName || contactNumber || 'C').trim().charAt(0).toUpperCase();
  const isUploading = uploadingKind !== null;
  // Chat is locked for sending when it's assigned to someone else (mirrors web app Conversation.js behaviour)
  const isLockedByAssignment = isAssigned && !assignmentInfo?.assigned_to_me;
  const canSend = !sending && !isUploading && !isLockedByAssignment && (!!pendingAttachment || !!inputText.trim());

  return (
    <Animated.View style={[styles.safe, { backgroundColor: theme.canvas, paddingBottom: keyboardHeightAnim }]}>
      {/* Sleek Top Header */}
      <FadeInView direction="down" distance={8} duration={250} style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <ScalePressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <Text style={[styles.backButtonText, { color: theme.ink }]}>‹</Text>
        </ScalePressable>

        <View style={[styles.avatar, { backgroundColor: theme.mint }]}>
          <Text style={[styles.avatarText, { color: theme.mintText }]}>{initialLetter}</Text>
        </View>

        <View style={styles.headerTitleContainer}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink }]}>{contactName}</Text>
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: theme.muted }]}>{contactNumber}</Text>
        </View>

        <View style={styles.headerRightActions}>
          <ScalePressable
            style={styles.headerIconBtn}
            hitSlop={8}
            onPress={() => setHeaderMenuOpen((open) => !open)}
          >
            <MoreVertical size={20} color={theme.ink} />
          </ScalePressable>
        </View>
      </FadeInView>

      {/* Header dropdown: Chat Assign + Case (same two actions as the web app's ⋮ menu) */}
      <Modal
        visible={headerMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHeaderMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setHeaderMenuOpen(false)}>
          <View style={[styles.headerDropdown, { backgroundColor: theme.header, borderColor: theme.border }]}>
            <ScalePressable style={styles.headerDropdownItem} onPress={openAssignModal}>
              <View style={[styles.headerDropdownIconWrap, { backgroundColor: theme.inputBg }]}>
                {isAssigned ? (
                  <UserCheck size={18} color={theme.emerald} />
                ) : (
                  <UserPlus size={18} color={theme.emerald} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerDropdownLabel, { color: theme.ink }]}>Chat Assign</Text>
                <Text style={[styles.headerDropdownSub, { color: theme.muted }]} numberOfLines={1}>
                  {isAssigned ? assignedUserName : 'Unassigned'}
                </Text>
              </View>
            </ScalePressable>

            <View style={[styles.headerDropdownDivider, { backgroundColor: theme.border }]} />

            <ScalePressable style={styles.headerDropdownItem} onPress={openCaseListModal}>
              <View style={[styles.headerDropdownIconWrap, { backgroundColor: theme.inputBg }]}>
                {(caseStatus ?? 0) > 0 ? (
                  <AlertCircle size={18} color="#D97706" />
                ) : (
                  <CheckCircle2 size={18} color={theme.emerald} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerDropdownLabel, { color: theme.ink }]}>Case</Text>
                <Text style={[styles.headerDropdownSub, { color: theme.muted }]} numberOfLines={1}>
                  {caseStatusLoading
                    ? 'Loading…'
                    : (caseStatus ?? 0) > 0
                      ? `Open (${caseStatus})`
                      : caseStatus === 0
                        ? 'Closed'
                        : '—'}
                </Text>
              </View>
            </ScalePressable>
          </View>
        </Pressable>
      </Modal>

      {/* Chat Assign modal: unassign (if assigned to me) + list of agents to assign to */}
      <Modal
        visible={assignModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setAssignModalOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.header }]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Assign chat</Text>
              <ScalePressable onPress={() => setAssignModalOpen(false)} hitSlop={8}>
                <X size={20} color={theme.muted} />
              </ScalePressable>
            </View>
            <Text style={[styles.sheetSubtitle, { color: theme.muted }]}>
              Current: {isAssigned ? assignedUserName : 'Unassigned'}
            </Text>

            {isAssigned && (
              <ScalePressable
                style={[styles.unassignRow, { borderColor: '#FCA5A5' }]}
                onPress={() => handleAssignChange('unassign')}
                disabled={assignActionLoading}
              >
                <Text style={styles.unassignText}>Unassign chat</Text>
              </ScalePressable>
            )}

            <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
              {assignmentUsers.length === 0 ? (
                <Text style={[styles.emptyHint, { color: theme.muted }]}>No agents found for assignment.</Text>
              ) : (
                assignmentUsers.map((user) => {
                  const active = assignedUsername === user.username;
                  return (
                    <ScalePressable
                      key={user.username}
                      style={[styles.agentRow, { borderColor: theme.border }, active && { opacity: 0.6 }]}
                      onPress={() => !active && handleAssignChange('assign', user.username)}
                      disabled={assignActionLoading || active}
                    >
                      <View style={[styles.agentAvatar, { backgroundColor: theme.inputBg }]}>
                        <Text style={{ color: theme.ink, fontWeight: '700' }}>
                          {(user.name || user.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.agentName, { color: theme.ink }]}>
                          {user.name || user.username || 'Unknown'}{user.is_me ? ' (You)' : ''}
                        </Text>
                        <Text style={[styles.agentSub, { color: theme.muted }]} numberOfLines={1}>
                          {user.email || user.mobile || user.username}
                        </Text>
                      </View>
                      {active ? (
                        <Check size={18} color={theme.emerald} />
                      ) : (
                        <UserPlus size={18} color={theme.emerald} />
                      )}
                    </ScalePressable>
                  );
                })
              )}
            </ScrollView>

            {assignActionLoading && (
              <ActivityIndicator style={{ marginTop: 10 }} color={theme.emerald} />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Case list modal */}
      <Modal
        visible={caseListModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCaseListModalOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setCaseListModalOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.header }]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Cases</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <ScalePressable onPress={openCaseCreateForm} hitSlop={8}>
                  <Plus size={20} color={theme.emerald} />
                </ScalePressable>
                <ScalePressable onPress={() => setCaseListModalOpen(false)} hitSlop={8}>
                  <X size={20} color={theme.muted} />
                </ScalePressable>
              </View>
            </View>

            {caseListLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={theme.emerald} />
            ) : (
              <ScrollView style={{ maxHeight: 380, marginTop: 6 }}>
                {caseList.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Briefcase size={28} color={theme.muted} />
                    <Text style={[styles.emptyHint, { color: theme.muted, marginTop: 8 }]}>No cases for this chat.</Text>
                    <ScalePressable
                      style={[styles.createCaseBtn, { backgroundColor: theme.emerald }]}
                      onPress={openCaseCreateForm}
                    >
                      <Text style={styles.createCaseBtnText}>Create case</Text>
                    </ScalePressable>
                  </View>
                ) : (
                  caseList.map((row, index) => {
                    const isOpen = row.status === true || row.status === '1';
                    return (
                      <ScalePressable
                        key={row.id ?? row.case_id ?? index}
                        style={[styles.caseRow, { borderColor: theme.border }]}
                        onPress={() => openCaseEditForm(row)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.agentName, { color: theme.ink }]} numberOfLines={1}>
                            {row.name || 'Untitled case'}
                          </Text>
                          {!!row.remark && (
                            <Text style={[styles.agentSub, { color: theme.muted }]} numberOfLines={1}>
                              {row.remark}
                            </Text>
                          )}
                        </View>
                        <View
                          style={[
                            styles.caseBadge,
                            { backgroundColor: isOpen ? '#FEF3C7' : '#D1FAE5' },
                          ]}
                        >
                          <Text style={{ color: isOpen ? '#92400E' : '#065F46', fontSize: 12, fontWeight: '700' }}>
                            {isOpen ? 'Open' : 'Closed'}
                          </Text>
                        </View>
                        <Edit2 size={16} color={theme.muted} style={{ marginLeft: 10 }} />
                      </ScalePressable>
                    );
                  })
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create / edit case form */}
      <Modal
        visible={caseFormOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCaseFormOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setCaseFormOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.header }]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>
                {caseFormMode === 'create' ? 'Create case' : 'Edit case'}
              </Text>
              <ScalePressable onPress={() => setCaseFormOpen(false)} hitSlop={8}>
                <X size={20} color={theme.muted} />
              </ScalePressable>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.muted }]}>Name</Text>
            <TextInput
              style={[styles.formInput, { color: theme.ink, borderColor: theme.border, backgroundColor: theme.inputBg }]}
              value={caseFormName}
              onChangeText={setCaseFormName}
              placeholder="Case name"
              placeholderTextColor={theme.muted}
            />

            <Text style={[styles.fieldLabel, { color: theme.muted, marginTop: 12 }]}>Remark</Text>
            <TextInput
              style={[
                styles.formInput,
                { color: theme.ink, borderColor: theme.border, backgroundColor: theme.inputBg, height: 80, textAlignVertical: 'top' },
              ]}
              value={caseFormRemark}
              onChangeText={setCaseFormRemark}
              placeholder="Remark"
              placeholderTextColor={theme.muted}
              multiline
            />

            <Text style={[styles.fieldLabel, { color: theme.muted, marginTop: 12 }]}>Status</Text>
            <View style={styles.statusToggleRow}>
              <Pressable
                style={[
                  styles.statusToggleBtn,
                  { borderColor: theme.border },
                  caseFormStatus === 'open' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                ]}
                onPress={() => setCaseFormStatus('open')}
              >
                <Text style={{ color: caseFormStatus === 'open' ? '#FFFFFF' : theme.ink, fontWeight: '600' }}>Open</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.statusToggleBtn,
                  { borderColor: theme.border },
                  caseFormStatus === 'closed' && { backgroundColor: '#10B981', borderColor: '#10B981' },
                ]}
                onPress={() => setCaseFormStatus('closed')}
              >
                <Text style={{ color: caseFormStatus === 'closed' ? '#FFFFFF' : theme.ink, fontWeight: '600' }}>Closed</Text>
              </Pressable>
            </View>

            <ScalePressable
              style={[styles.submitBtn, { backgroundColor: theme.emerald }]}
              onPress={submitCaseForm}
              disabled={caseFormSubmitting}
            >
              {caseFormSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{caseFormMode === 'create' ? 'Create' : 'Save'}</Text>
              )}
            </ScalePressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Message List area */}
      <View style={[styles.chatBackground, { backgroundColor: theme.chatBg }]}>
        <ChatWallpaper isDark={theme.isDark} />
        <FlatList
          data={messages}
          keyExtractor={(item, index) => {
            const baseId = item.id || item.message_id || item.wamid || item.unique_id;
            return baseId ? `${baseId}-${index}` : `msg-${index}`;
          }}
          renderItem={renderMessage}
          inverted={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={messages.length ? styles.listContent : styles.listContentEmpty}
          onEndReached={() => loadHistory(true)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }, { scaleX: -1 }] }}>
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

      {/* Attachment menu */}
      {attachMenuOpen && (
        <FadeInView direction="up" distance={12} duration={200}>
          <View style={[styles.attachMenu, { backgroundColor: theme.header, borderColor: theme.border }]}>
            <AttachmentOption
              label="Photo"
              icon={ImageIcon}
              onPress={() => handlePickAttachment('photo')}
              theme={theme}
            />
            <AttachmentOption
              label="Video"
              icon={Video}
              onPress={() => handlePickAttachment('video')}
              theme={theme}
            />
            <AttachmentOption
              label="Document"
              icon={FileText}
              onPress={() => handlePickAttachment('document')}
              theme={theme}
            />
            <AttachmentOption
              label="Audio"
              icon={Music}
              onPress={() => handlePickAttachment('audio')}
              theme={theme}
            />
            <AttachmentOption
              label="Template"
              icon={LayoutTemplate}
              onPress={() => {
                setAttachMenuOpen(false);
                setTemplateMenuOpen(true);
              }}
              theme={theme}
            />
          </View>
        </FadeInView>
      )}

      {/* NEW: Pending attachment preview, shown above the input bar until sent or cancelled */}
      {pendingAttachment && (
        <FadeInView direction="up" distance={10} duration={200}>
          <View style={[styles.previewBar, { backgroundColor: theme.inputContainerBg, borderColor: theme.border }]}>
            {pendingAttachment.kind === 'photo' ? (
              <Image source={{ uri: pendingAttachment.file.uri }} style={styles.previewThumb} resizeMode="cover" />
            ) : (
              <View style={[styles.previewIconBox, { backgroundColor: theme.inputBg }]}>
                <Text style={styles.previewIconText}>
                  {pendingAttachment.kind === 'video' ? '🎬' : pendingAttachment.kind === 'audio' ? '🎵' : '📄'}
                </Text>
              </View>
            )}

            <View style={styles.previewInfo}>
              <Text style={[styles.previewName, { color: theme.ink }]} numberOfLines={1}>
                {pendingAttachment.file.name}
              </Text>
              <Text style={[styles.previewKind, { color: theme.muted }]}>
                {isUploading
                  ? 'Sending…'
                  : pendingAttachment.kind.charAt(0).toUpperCase() + pendingAttachment.kind.slice(1)}
              </Text>
            </View>

            {isUploading ? (
              <ActivityIndicator size="small" color={theme.muted} style={styles.previewCancel} />
            ) : (
              <ScalePressable onPress={cancelPendingAttachment} hitSlop={8} style={styles.previewCancel}>
                <Text style={[styles.previewCancelText, { color: theme.ink }]}>✕</Text>
              </ScalePressable>
            )}
          </View>
        </FadeInView>
      )}

      {/* Reply Preview Banner */}
      {replyingTo && (
        <FadeInView direction="up" distance={10} duration={200}>
          <View style={[styles.replyBanner, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <View style={[styles.replyBannerContent, { borderLeftColor: '#3B82F6' }]}>
              <View style={styles.replyBannerTextWrap}>
                <View style={styles.replyBannerHeader}>
                  <CornerUpLeft size={14} color="#3B82F6" />
                  <Text style={[styles.replyBannerLabel, { color: '#3B82F6' }]}>
                    Replying to {replyingTo.type === 'out' ? 'yourself' : (contactName || contactNumber)}
                  </Text>
                </View>
                <Text style={[styles.replyBannerMessage, { color: theme.muted }]} numberOfLines={1}>
                  {(() => {
                    const rt = (replyingTo.message_type || 'text').toLowerCase();
                    if (rt === 'image' || rt === 'photo') return replyingTo.message || '📷 Photo';
                    if (rt === 'video') return replyingTo.message || '🎥 Video';
                    if (rt === 'document') return replyingTo.media_name || '📄 Document';
                    if (rt === 'audio') return replyingTo.is_voice ? '🎤 Voice message' : '🎵 Audio';
                    if (rt === 'template') return resolveTemplateBodyText(replyingTo);
                    return replyingTo.message || 'Message';
                  })()}
                </Text>
              </View>
              <ScalePressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                <X size={20} color={theme.muted} />
              </ScalePressable>
            </View>
          </View>
        </FadeInView>
      )}

      {/* Assignment Lock Banner — replaces the input bar when chat is assigned to someone else */}
      {isLockedByAssignment ? (
        <ScalePressable
          onPress={openAssignModal}
          style={[styles.assignedLockBanner, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
          activeOpacity={0.85}
        >
          <View style={styles.assignedLockIcon}>
            <UserCheck size={18} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.assignedLockTitle, { color: theme.ink }]}>
              Chat Assigned to {assignedUserName}
            </Text>
            <Text style={[styles.assignedLockSub, { color: theme.muted }]}>
              Request reassignment to send messages.
            </Text>
          </View>
          <Text style={[styles.assignedLockChevron, { color: theme.muted }]}>›</Text>
        </ScalePressable>
      ) : (
        /* Input Bar */
        <View style={[styles.inputContainer, { backgroundColor: theme.inputContainerBg, borderTopWidth: 1, borderTopColor: theme.border }]}>
          <ScalePressable
            style={styles.attachButton}
            hitSlop={8}
            disabled={isUploading}
            onPress={() => setAttachMenuOpen(open => !open)}
          >
            {attachMenuOpen ? (
              <X size={22} color={theme.emerald} />
            ) : (
              <Plus size={22} color={theme.emerald} />
            )}
          </ScalePressable>

          <View style={[styles.inputPill, { backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.textInput, { color: theme.ink }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={pendingAttachment ? 'Add a caption…' : 'Message'}
              placeholderTextColor={theme.muted}
              multiline
            />
          </View>
          <ScalePressable
            style={[
              styles.sendButton,
              { backgroundColor: theme.emerald },
              !canSend && { backgroundColor: theme.muted },
            ]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {sending || isUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonIcon}>➤</Text>
            )}
          </ScalePressable>
        </View>
      )}

      <TemplateModal
        visible={templateMenuOpen}
        onClose={() => setTemplateMenuOpen(false)}
        session={session}
        projectId={projectId}
        onSelectTemplate={handleSendTemplate}
      />

      <MediaViewerModal
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        mediaUrl={viewerUrl}
        mediaType={viewerType}
        mediaName={viewerName}
      />
    </Animated.View>
  );
}

function AttachmentOption({
  label,
  icon: IconComponent,
  onPress,
  theme,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
  theme: any;
}) {
  return (
    <ScalePressable style={styles.attachMenuItem} onPress={onPress}>
      <View style={[styles.attachMenuIconWrap, { backgroundColor: theme.inputBg }]}>
        <IconComponent size={22} color={theme.emerald} strokeWidth={2} />
      </View>
      <Text style={[styles.attachMenuLabel, { color: theme.ink }]}>{label}</Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  keyboardArea: {
    flex: 1,
  },
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
  attachMenuItem: {
    alignItems: 'center',
    width: 72,
  },
  attachMenuIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMenuLabel: {
    fontSize: 12,
    marginTop: 6,
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
  // ── Header dropdown menu (Chat Assign / Case) ──────────────────────
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  headerDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 92 : 68,
    right: 12,
    width: 240,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  headerDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  headerDropdownIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDropdownLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerDropdownSub: {
    fontSize: 12,
    marginTop: 1,
  },
  headerDropdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
  // ── Bottom sheets (assign modal / case list / case form) ───────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  unassignRow: {
    marginTop: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  unassignText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  agentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  agentSub: {
    fontSize: 12,
    marginTop: 1,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  caseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  caseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  createCaseBtn: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  createCaseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  statusToggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitBtn: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
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
    overflow: 'hidden',
  },
  messageBubbleMedia: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  captionPad: {
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 2,
  },
  messageFooterMedia: {
    paddingHorizontal: 8,
    paddingBottom: 4,
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
  mediaImage: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: 0,
  },
  mediaPlaceholder: {
    width: 220,
    height: 140,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  mediaPlaceholderLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 160,
  },
  documentIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  documentName: {
    fontSize: 14,
    flexShrink: 1,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  attachButtonIcon: {
    fontSize: 24,
    fontWeight: '600',
  },
  attachMenu: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderRadius: 20,
    marginHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  previewThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  previewIconBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIconText: {
    fontSize: 20,
  },
  previewInfo: {
    flex: 1,
    marginLeft: 10,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewKind: {
    fontSize: 12,
    marginTop: 2,
  },
  previewCancel: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  previewCancelText: {
    fontSize: 18,
    fontWeight: '700',
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
  replyContext: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  replyContextName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
  },
  replyContextText: {
    fontSize: 13,
    lineHeight: 16,
  },
  replyBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  replyBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.06)',
  },
  replyBannerTextWrap: {
    flex: 1,
  },
  replyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  replyBannerLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyBannerMessage: {
    fontSize: 13,
  },
  // ── Assignment lock banner (shown instead of input bar when chat is assigned to someone else) ──
  assignedLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  assignedLockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedLockTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  assignedLockSub: {
    fontSize: 11,
    marginTop: 2,
  },
  assignedLockChevron: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
  },
});

function ChatWallpaper({isDark}: {isDark: boolean}) {
  const stroke = isDark ? '#A5BBC3' : '#8EA69C';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" opacity={isDark ? 0.11 : 0.19}>
        <Pattern id="chatDoodle" width="154" height="146" patternUnits="userSpaceOnUse">
          <G transform="rotate(-12 27 22)"><Path d="M10 20c0-8 7-14 16-14s16 6 16 14-7 14-16 14c-3 0-6-1-8-2l-9 5 3-9c-1-2-2-5-2-8Z" fill="none" stroke={stroke} strokeWidth="1.25" /><Circle cx="20" cy="20" r="1.2" fill={stroke} /><Circle cx="26" cy="20" r="1.2" fill={stroke} /><Circle cx="32" cy="20" r="1.2" fill={stroke} /></G>
          <G transform="rotate(18 92 20)"><Path d="m80 18 6 6 12-15M101 12l7 7m0-7-7 7" fill="none" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" /></G>
          <G transform="rotate(-24 132 39)"><Path d="M123 38c0-5 4-9 9-9s9 4 9 9-4 9-9 9l-5 4 1-6c-3-2-5-4-5-7Z" fill="none" stroke={stroke} strokeWidth="1.2" /></G>
          <G transform="rotate(12 55 61)"><Path d="M43 61c7-9 19-9 26 0M49 63c3 5 11 7 15 0" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" /></G>
          <G transform="rotate(-15 100 65)"><Path d="M89 58h18v15H89zM93 58v-4h10v4M95 66h6" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" /></G>
          <G transform="rotate(22 23 100)"><Path d="M15 94c0-4 3-7 7-7h4c4 0 7 3 7 7v5c0 4-3 7-7 7h-4c-4 0-7-3-7-7v-5Z M19 106v4m10-4v4m-10-19h10" fill="none" stroke={stroke} strokeWidth="1.1" strokeLinecap="round" /></G>
          <G transform="rotate(-17 66 113)"><Path d="M55 113c0-6 5-11 11-11s11 5 11 11-5 11-11 11l-6 4 2-7c-4-2-7-5-7-8Z M61 113l3 3 6-7" fill="none" stroke={stroke} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" /></G>
          <G transform="rotate(10 120 112)"><Path d="m110 105 10-5 10 5v10l-10 5-10-5v-10ZM120 100v20M110 105l10 6 10-6" fill="none" stroke={stroke} strokeWidth="1.1" strokeLinejoin="round" /></G>
          <G transform="rotate(-20 143 84)"><Path d="M136 82h13m-7-6 7 6-7 6" fill="none" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></G>
          <Circle cx="78" cy="87" r="3" fill="none" stroke={stroke} strokeWidth="1.1" />
          <Path d="m73 91 10-8M3 57l5 5m0-5-5 5M143 132l4 4m0-4-4 4" fill="none" stroke={stroke} strokeWidth="1.1" strokeLinecap="round" />
        </Pattern>
        <Rect width="100%" height="100%" fill="url(#chatDoodle)" />
      </Svg>
    </View>
  );
}

function SwipeableMessageWrapper({ children, onSwipe, enabled }: { children: React.ReactNode, onSwipe: () => void, enabled: boolean }) {
  const pan = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (!enabled) return false;
        return gestureState.dx > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0) {
          const val = gestureState.dx < 60 ? gestureState.dx : 60 + (gestureState.dx - 60) * 0.2;
          pan.setValue(val);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 50) {
          onSwipe();
        }
        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 12,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: 16,
          opacity: pan.interpolate({ inputRange: [0, 50], outputRange: [0, 1] }),
          transform: [{ scale: pan.interpolate({ inputRange: [0, 50], outputRange: [0.5, 1], extrapolate: 'clamp' }) }]
        }}
      >
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Reply size={14} color="#FFF" />
        </View>
      </Animated.View>
      <Animated.View
        {...(enabled ? panResponder.panHandlers : {})}
        style={{ flex: 1, transform: [{ translateX: pan }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}