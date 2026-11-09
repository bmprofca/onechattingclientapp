import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Activity, RefreshCw, X } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getContactTimeline } from '../api/workspace';
import { useTheme } from '../theme/theme';

type TimelineEvent = {
  event_id: string;
  title: string;
  description?: string | null;
  occurred_at?: string | null;
  actor?: string | null;
};

function formatTimelineDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0))
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function ContactTimelineModal({
  visible,
  onClose,
  projectId,
  number,
  session,
}: {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  number: string;
  session: ApiSession;
}) {
  const theme = useTheme();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (nextPage: number, append: boolean) => {
    if (loadingRef.current || !projectId || !number || !session?.token) return;
    loadingRef.current = true;
    const version = requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const response = await getContactTimeline(session, projectId, number, nextPage, 20);
      if (version !== requestVersion.current) return;
      const rows = Array.isArray(response?.data) ? response.data : [];
      setEvents(current => append ? [...current, ...rows] : rows);
      setPage(nextPage);
      setHasMore(Boolean(response?.meta?.has_more));
    } catch (loadError: any) {
      if (version === requestVersion.current) {
        setError(loadError?.message || 'Could not load contact activity.');
      }
    } finally {
      if (version === requestVersion.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [number, projectId, session.token, session.username]);

  useEffect(() => {
    requestVersion.current += 1;
    loadingRef.current = false;
    setEvents([]);
    setPage(1);
    setHasMore(false);
    setError('');
    if (visible) loadPage(1, false);
    return () => {
      requestVersion.current += 1;
    };
  }, [loadPage, visible]);

  const retry = () => loadPage(events.length ? page + 1 : 1, events.length > 0);
  const renderEvent = ({ item }: { item: TimelineEvent }) => (
    <View style={styles.eventRow}>
      <View style={[styles.eventIcon, { backgroundColor: theme.inputBg }]}>
        <Activity size={16} color={theme.emerald} />
      </View>
      <View style={styles.eventBody}>
        <Text style={[styles.eventTitle, { color: theme.ink }]}>{item.title}</Text>
        {!!item.description && (
          <Text style={[styles.eventDescription, { color: theme.muted }]}>{item.description}</Text>
        )}
        <Text style={[styles.eventMeta, { color: theme.muted }]}>
          {formatTimelineDate(item.occurred_at)}
          {item.actor ? ` · ${item.actor}` : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close contact timeline" />
        <View style={[styles.sheet, { backgroundColor: theme.header, borderColor: theme.border }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={[styles.headerIcon, { backgroundColor: theme.inputBg }]}>
              <Activity size={18} color={theme.emerald} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.ink }]}>Contact timeline</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]} numberOfLines={1}>{number}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={theme.ink} />
            </Pressable>
          </View>

          {loading && events.length === 0 ? (
            <View style={styles.state}>
              <ActivityIndicator color={theme.emerald} />
              <Text style={[styles.stateText, { color: theme.muted }]}>Loading activity…</Text>
            </View>
          ) : error && events.length === 0 ? (
            <View style={styles.state}>
              <Text style={[styles.errorText, { color: theme.danger || '#DC2626' }]}>{error}</Text>
              <Pressable onPress={retry} style={styles.retryButton} accessibilityRole="button">
                <Text style={[styles.retryText, { color: theme.emerald }]}>Retry</Text>
              </Pressable>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.state}>
              <Activity size={24} color={theme.muted} />
              <Text style={[styles.stateText, { color: theme.muted }]}>No activity for this contact yet.</Text>
            </View>
          ) : (
            <FlatList
              data={events}
              keyExtractor={item => item.event_id}
              renderItem={renderEvent}
              contentContainerStyle={styles.list}
              onEndReached={() => {
                if (hasMore && !loading) loadPage(page + 1, true);
              }}
              onEndReachedThreshold={0.35}
              ListFooterComponent={(
                <View style={styles.footer}>
                  {loading && <ActivityIndicator color={theme.emerald} />}
                  {!!error && <Text style={[styles.errorText, { color: theme.danger || '#DC2626' }]}>{error}</Text>}
                  {!loading && hasMore && (
                    <Pressable onPress={retry} style={styles.retryButton} accessibilityRole="button">
                      <RefreshCw size={15} color={theme.emerald} />
                      <Text style={[styles.retryText, { color: theme.emerald }]}>Load older activity</Text>
                    </Pressable>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    height: '82%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  list: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  eventIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  eventMeta: {
    marginTop: 5,
    fontSize: 11,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
});
