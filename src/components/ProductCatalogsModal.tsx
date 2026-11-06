import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RefreshCw, Search, ShoppingBag, X } from 'lucide-react-native';
import { ApiSession } from '../api/client';
import { getProductCatalogConnectLink, getProductCatalogs } from '../api/workspace';
import { useTheme } from '../theme/theme';
import { ScalePressable } from './animations';

type Catalog = {
  id: string;
  name?: string;
  vertical?: string;
  product_count?: number;
  business?: { name?: string };
};

type ProductCatalogsModalProps = {
  visible: boolean;
  onClose: () => void;
  session: ApiSession;
  projectId: string;
};

export function ProductCatalogsModal({
  visible,
  onClose,
  session,
  projectId,
}: ProductCatalogsModalProps) {
  const theme = useTheme();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);
  const verifyConnectionOnResumeRef = useRef(false);

  const loadCatalogs = useCallback(async (after = '', append = false, verifyConnection = false) => {
    if (!projectId) {
      setError('Select a project before viewing product catalogs.');
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setNeedsConnection(false);
    setError('');
    try {
      const response = await getProductCatalogs(
        session,
        projectId,
        after ? { after } : undefined,
        verifyConnection,
      );
      const data = response?.data || response;
      const page = Array.isArray(data?.catalogs) ? data.catalogs : [];
      setCatalogs((current) => append ? [...current, ...page] : page);
      setNeedsConnection(!append && (
        typeof data?.catalog_connected === 'boolean'
          ? !data.catalog_connected
          : page.length === 0
      ));
      setNextCursor(typeof data?.paging?.after === 'string' ? data.paging.after : '');
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'CATALOG_NOT_CONNECTED') {
        setNeedsConnection(true);
        setCatalogs([]);
        setNextCursor('');
        setError('');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load product catalogs');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [projectId, session]);

  const connectCatalog = useCallback(async () => {
    if (!projectId) {
      setError('Select a project before connecting a product catalog.');
      return;
    }

    setConnecting(true);
    setError('');
    try {
      const response = await getProductCatalogConnectLink(session, projectId);
      const url = response?.url || response?.data?.url;
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        throw new Error('AiSensy did not return a valid catalog connection link.');
      }
      verifyConnectionOnResumeRef.current = true;
      await Linking.openURL(url);
    } catch (err) {
      verifyConnectionOnResumeRef.current = false;
      setError(err instanceof Error ? err.message : 'Unable to start the catalog connection.');
    } finally {
      setConnecting(false);
    }
  }, [projectId, session]);

  useEffect(() => {
    if (!visible) return;
    setCatalogs([]);
    setNextCursor('');
    setSearch('');
    setNeedsConnection(false);
    loadCatalogs();
  }, [loadCatalogs, visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && verifyConnectionOnResumeRef.current) {
        verifyConnectionOnResumeRef.current = false;
        loadCatalogs('', false, true);
      }
    });
    return () => subscription.remove();
  }, [loadCatalogs, visible]);

  const filteredCatalogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalogs;
    return catalogs.filter((catalog) =>
      `${catalog.name || ''} ${catalog.id} ${catalog.vertical || ''} ${catalog.business?.name || ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [catalogs, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface }]}
          onPress={() => {}}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.titleWrap}>
              <ShoppingBag size={20} color={theme.emerald} />
              <View>
                <Text style={[styles.title, { color: theme.ink }]}>Product catalogs</Text>
                <Text style={[styles.subtitle, { color: theme.muted }]}>
                  Catalogs connected to this WhatsApp account
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <ScalePressable
                onPress={() => loadCatalogs()}
                disabled={loading}
                hitSlop={8}
              >
                <RefreshCw size={18} color={theme.muted} />
              </ScalePressable>
              <ScalePressable onPress={onClose} hitSlop={8}>
                <X size={20} color={theme.muted} />
              </ScalePressable>
            </View>
          </View>

          <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Search size={16} color={theme.muted} />
            <TextInput
              style={[styles.searchInput, { color: theme.ink }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search catalogs"
              placeholderTextColor={theme.muted}
            />
          </View>

          {error && catalogs.length === 0 ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.errorText, { color: '#DC2626' }]}>{error}</Text>
              {needsConnection && (
                <ScalePressable
                  style={[styles.connectButton, { backgroundColor: theme.emerald }]}
                  onPress={connectCatalog}
                  disabled={connecting}
                >
                  <Text style={styles.connectText}>{connecting ? 'Opening connection…' : 'Connect catalog'}</Text>
                </ScalePressable>
              )}
              <ScalePressable
                style={[styles.retryButton, { borderColor: theme.border }]}
                onPress={() => loadCatalogs()}
                disabled={loading}
              >
                <Text style={[styles.retryText, { color: theme.ink }]}>Try again</Text>
              </ScalePressable>
            </View>
          ) : loading && catalogs.length === 0 ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={theme.emerald} />
              <Text style={[styles.stateText, { color: theme.muted }]}>Loading catalogs…</Text>
            </View>
          ) : (
            <FlatList
              data={filteredCatalogs}
              keyExtractor={(item, index) => `${item.id || item.name || 'catalog'}-${index}`}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={error ? (
                <Text style={[styles.errorText, { color: '#DC2626', marginBottom: 8 }]}>{error}</Text>
              ) : null}
              renderItem={({ item }) => (
                <View style={[styles.catalogCard, { backgroundColor: theme.canvas, borderColor: theme.border }]}>
                  <View style={[styles.catalogIcon, { backgroundColor: theme.mint }]}>
                    <ShoppingBag size={18} color={theme.mintText} />
                  </View>
                  <View style={styles.catalogInfo}>
                    <Text style={[styles.catalogName, { color: theme.ink }]} numberOfLines={1}>
                      {item.name || 'Unnamed catalog'}
                    </Text>
                    <Text style={[styles.catalogDetail, { color: theme.muted }]} numberOfLines={1}>
                      {item.product_count ?? 0} products · {item.vertical || 'Catalog'}
                    </Text>
                    <Text style={[styles.catalogId, { color: theme.muted }]} numberOfLines={1}>
                      ID: {item.id}
                    </Text>
                    {!!item.business?.name && (
                      <Text style={[styles.catalogDetail, { color: theme.muted }]} numberOfLines={1}>
                        {item.business.name}
                      </Text>
                    )}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.stateWrap}>
                  <Text style={[styles.stateText, { color: theme.muted }]}>
                    {search ? 'No catalogs match your search.' : needsConnection ? 'Connect a Meta catalog to use it in conversations.' : 'No product catalogs are connected to this account.'}
                  </Text>
                  {!search && needsConnection && (
                    <ScalePressable
                      style={[styles.connectButton, { backgroundColor: theme.emerald }]}
                      onPress={connectCatalog}
                      disabled={connecting}
                    >
                      <Text style={styles.connectText}>{connecting ? 'Opening connection…' : 'Connect catalog'}</Text>
                    </ScalePressable>
                  )}
                </View>
              }
              ListFooterComponent={
                nextCursor ? (
                  <ScalePressable
                    style={[styles.loadMoreButton, { borderColor: theme.border }]}
                    onPress={() => loadCatalogs(nextCursor, true)}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={theme.emerald} />
                    ) : (
                      <Text style={[styles.loadMoreText, { color: theme.emerald }]}>Load more</Text>
                    )}
                  </ScalePressable>
                ) : null
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '85%',
    minHeight: '55%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginLeft: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingTop: 12,
    gap: 10,
  },
  catalogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  catalogIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogInfo: {
    flex: 1,
  },
  catalogName: {
    fontSize: 14,
    fontWeight: '700',
  },
  catalogDetail: {
    marginTop: 4,
    fontSize: 12,
  },
  catalogId: {
    marginTop: 4,
    fontSize: 11,
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  stateText: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 10,
  },
  connectButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  connectText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadMoreButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
