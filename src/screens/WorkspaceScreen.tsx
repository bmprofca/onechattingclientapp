import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCampaigns, getContacts, getInbox, getOpenCases, getProjectMeta, getTemplates, getUnreadCount, ListItem, unwrapList } from '../api/workspace';
import { Session } from '../services/session';
import { LoadState } from '../components/LoadState';
import { colors } from '../theme/theme';

type Tab = 'Inbox' | 'Campaigns' | 'Contacts' | 'Templates' | 'More';
const tabs: { name: Tab; glyph: string }[] = [{ name: 'Inbox', glyph: 'IN' }, { name: 'Campaigns', glyph: 'CA' }, { name: 'Contacts', glyph: 'CO' }, { name: 'Templates', glyph: 'TE' }, { name: 'More', glyph: 'ME' }];
const pageCopy: Record<Tab, { title: string; subtitle: string }> = {
  Inbox: { title: 'Inbox', subtitle: 'Live conversations and open cases' },
  Campaigns: { title: 'Campaigns', subtitle: 'Plan, schedule, and monitor broadcasts' },
  Contacts: { title: 'Contacts', subtitle: 'Your customer directory and groups' },
  Templates: { title: 'Templates', subtitle: 'Approved WhatsApp message templates' },
  More: { title: 'Workspace', subtitle: 'Your business overview and tools' },
};
const nameOf = (item: ListItem) => String(item.name || item.contact_name || item.template_name || item.campaign_name || item.phone || 'Untitled');
const detailOf = (item: ListItem) => String(item.message || item.status || item.category || item.phone || item.email || 'No details available');
const initialOf = (value: string) => value.trim().charAt(0).toUpperCase() || '1';
const numericValue = (value: any) => value?.data?.count ?? value?.count ?? value?.data?.total ?? value?.total ?? value?.data?.unread_count ?? value?.unread_count ?? 0;

export function WorkspaceScreen({ session, onChooseProject, onSignOut }: { session: Session; onChooseProject: () => void; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('More');
  const [inboxMode, setInboxMode] = useState<'chats' | 'cases'>('chats');
  const projectId = session.selectedProjectId || session.projects[0]?.id || '';
  const [items, setItems] = useState<ListItem[]>([]);
  const [info, setInfo] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const sessionHeaders = useMemo(() => ({ token: session.token, username: session.username }), [session.token, session.username]);
  const selectedProject = session.projects.find(project => project.id === projectId);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 'More') {
        const [projectInfo, unreadResult] = await Promise.all([getProjectMeta(sessionHeaders, projectId), getUnreadCount(sessionHeaders, projectId)]);
        setInfo(projectInfo);
        setUnread(Number(numericValue(unreadResult)) || 0);
      } else {
        const request = tab === 'Inbox' ? (inboxMode === 'chats' ? getInbox : getOpenCases) : tab === 'Campaigns' ? getCampaigns : tab === 'Contacts' ? getContacts : getTemplates;
        const result = await request(sessionHeaders, projectId);
        setItems(unwrapList(result));
        if (tab === 'Inbox') setUnread(unwrapList(result).length);
      }
    } catch (requestError) {
      setItems([]);
      setError(requestError instanceof Error ? requestError.message : 'Could not load this data.');
    } finally {
      setLoading(false);
    }
  }, [inboxMode, projectId, sessionHeaders, tab]);

  useEffect(() => { load(); }, [load]);

  if (!projectId) return <SafeAreaView style={styles.emptyScreen}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>1</Text></View><Text style={styles.emptyTitle}>No workspace yet</Text><Text style={styles.emptyCopy}>Your account does not have an available project. Contact your administrator or sign in with a different account.</Text><Pressable accessibilityRole="button" onPress={onSignOut} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Sign out</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <View><Text style={styles.greeting}>1chatting</Text><Text style={styles.headerName}>{selectedProject?.name || 'Workspace'}</Text></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose another project" onPress={onChooseProject} style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint }}><Text style={{ fontSize: 22, lineHeight: 24, fontWeight: '800', color: colors.emerald }}>⇄</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open workspace menu" onPress={() => setMenuOpen(open => !open)} style={styles.menuButton}><Text style={styles.menuDots}>•••</Text></Pressable>
      </View>

    </View>
    {menuOpen && <><Pressable accessibilityLabel="Close workspace menu" onPress={() => setMenuOpen(false)} style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40}} /><View style={[styles.menu, {top: 120, right: 20}]}><Pressable onPress={() => { setTab('Inbox'); setMenuOpen(false); }} style={styles.menuItem}><Text style={styles.menuItemText}>Live chat</Text></Pressable><Pressable onPress={() => { setTab('Campaigns'); setMenuOpen(false); }} style={styles.menuItem}><Text style={styles.menuItemText}>Campaigns</Text></Pressable><Pressable onPress={() => { setTab('More'); setMenuOpen(false); }} style={styles.menuItem}><Text style={styles.menuItemText}>Workspace dashboard</Text></Pressable></View></>}
    <View style={styles.body}>
      {tab === 'More' ? <Dashboard projectName={selectedProject?.name || 'Workspace'} info={info} unread={unread} loading={loading} error={error} reload={load} onSignOut={onSignOut} /> : <Collection tab={tab} inboxMode={inboxMode} onInboxModeChange={setInboxMode} items={items} loading={loading} error={error} reload={load} />}
    </View>
  </SafeAreaView>;
}

function Collection({ tab, inboxMode, onInboxModeChange, items, loading, error, reload }: { tab: Tab; inboxMode: 'chats' | 'cases'; onInboxModeChange: (mode: 'chats' | 'cases') => void; items: ListItem[]; loading: boolean; error: string; reload: () => void }) {
  const copy = tab === 'Inbox' && inboxMode === 'cases' ? { title: 'Open cases', subtitle: 'Customer issues assigned to your workspace' } : pageCopy[tab];
  return <FlatList data={items} keyExtractor={(item, index) => String(item.id || item._id || index)} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.emerald} />} contentContainerStyle={items.length ? styles.list : styles.emptyList} ListHeaderComponent={<View style={styles.pageHeading}><Text style={styles.pageTitle}>{copy.title}</Text><Text style={styles.pageSubtitle}>{copy.subtitle}</Text>{tab === 'Inbox' && <View style={styles.segmented}><Pressable accessibilityRole="button" onPress={() => onInboxModeChange('chats')} style={[styles.segment, inboxMode === 'chats' && styles.activeSegment]}><Text style={[styles.segmentText, inboxMode === 'chats' && styles.activeSegmentText]}>Live chat</Text></Pressable><Pressable accessibilityRole="button" onPress={() => onInboxModeChange('cases')} style={[styles.segment, inboxMode === 'cases' && styles.activeSegment]}><Text style={[styles.segmentText, inboxMode === 'cases' && styles.activeSegmentText]}>Open cases</Text></Pressable></View>}<View style={styles.sectionRule} /></View>} ListEmptyComponent={<LoadState loading={loading} error={error} empty={!loading && !error} onRetry={reload} />} renderItem={({ item }) => <CollectionCard tab={tab} item={item} />} />;
}

function CollectionCard({ tab, item }: { tab: Tab; item: ListItem }) {
  const name = nameOf(item);
  const detail = detailOf(item);
  const status = String(item.status || (tab === 'Inbox' ? 'Open' : 'Active'));
  return <Pressable accessibilityRole="button" style={styles.collectionCard}>
    <View style={[styles.cardAvatar, tab === 'Campaigns' && styles.campaignAvatar, tab === 'Templates' && styles.templateAvatar]}><Text style={styles.cardAvatarText}>{initialOf(name)}</Text></View>
    <View style={styles.cardBody}><Text numberOfLines={1} style={styles.cardTitle}>{name}</Text><Text numberOfLines={2} style={styles.cardDetail}>{detail}</Text><Text style={styles.cardMeta}>{tab === 'Inbox' ? 'Conversation' : status}</Text></View>
    <View style={styles.cardArrow}><Text style={styles.cardArrowText}>›</Text></View>
  </Pressable>;
}

function Dashboard({ projectName, info, unread, loading, error, reload, onSignOut }: { projectName: string; info: any; unread: number; loading: boolean; error: string; reload: () => void; onSignOut: () => void }) {
  const value = info?.data || info || {};
  const balance = String(value.wallet_balance || value.balance || '0');
  const actions = [{ title: 'Projects', note: 'Switch workspace' }, { title: 'Wallet', note: 'Balance & top-up' }, { title: 'Profile', note: 'Account details' }, { title: 'Automation', note: 'Replies & agents' }, { title: 'Team', note: 'People & access' }, { title: 'Support', note: 'Help center' }];
  return <ScrollView contentContainerStyle={styles.dashboard} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.emerald} />}><Text style={styles.pageTitle}>Workspace</Text><Text style={styles.pageSubtitle}>{projectName}</Text><LoadState loading={loading} error={error} empty={false} onRetry={reload} />{!loading && !error && <><View style={styles.overview}><Text style={styles.overviewLabel}>AVAILABLE WALLET BALANCE</Text><Text style={styles.balance}>Rs. {balance}</Text><Text style={styles.overviewHint}>Use wallet credit for messages and campaigns</Text></View><View style={styles.metrics}><Metric value={String(unread)} label="Unread chats" tone="emerald" /><Metric value={String(value.project_count || value.projects || '1')} label="Projects" tone="blue" /></View><Text style={styles.sectionTitle}>Manage workspace</Text><View style={styles.actionGrid}>{actions.map(action => <Pressable accessibilityRole="button" key={action.title} style={styles.actionCard}><Text style={styles.actionTitle}>{action.title}</Text><Text style={styles.actionNote}>{action.note}</Text><Text style={styles.actionArrow}>›</Text></Pressable>)}</View><View style={styles.projectCard}><Text style={styles.projectCardLabel}>CURRENT WHATSAPP ACCOUNT</Text><Text style={styles.projectCardTitle}>{String(value.waba_name || value.project_name || projectName)}</Text><Text style={styles.projectCardDetail}>{String(value.waba_id || 'Configure business profile and messaging settings')}</Text></View><Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable></>}</ScrollView>;
}

function Metric({ value, label, tone }: { value: string; label: string; tone: 'emerald' | 'blue' }) { return <View style={[styles.metric, tone === 'blue' && styles.metricBlue]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8F7' }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, greeting: { fontSize: 12, color: colors.muted }, headerName: { fontSize: 18, color: colors.ink, fontWeight: '800', marginTop: 2 }, menuButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint }, menuDots: { fontSize: 16, letterSpacing: 1, color: colors.emerald, fontWeight: '900', marginTop: -7 }, menu: { position: 'absolute', top: 67, right: 16, zIndex: 50, elevation: 12, width: 200, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: .15, shadowRadius: 12 }, menuItem: { minHeight: 46, paddingHorizontal: 15, justifyContent: 'center' }, menuItemText: { fontSize: 14, fontWeight: '700', color: colors.ink }, projectRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: colors.border }, projectChip: { height: 38, maxWidth: 190, borderRadius: 19, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, marginRight: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' }, projectChipActive: { borderColor: colors.emerald, backgroundColor: colors.mint }, projectDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B7C7C0', marginRight: 7 }, projectDotActive: { backgroundColor: colors.emerald }, projectChipText: { color: colors.muted, fontWeight: '700', fontSize: 12 }, projectChipTextActive: { color: colors.ink }, body: { flex: 1 }, pageHeading: { paddingTop: 21, paddingBottom: 5 }, pageTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -.7, color: colors.ink }, pageSubtitle: { fontSize: 13, color: colors.muted, marginTop: 5 }, segmented: { height: 40, marginTop: 17, padding: 3, borderRadius: 12, backgroundColor: '#EAF0ED', flexDirection: 'row' }, segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, activeSegment: { backgroundColor: '#FFF' }, segmentText: { fontSize: 12, fontWeight: '700', color: colors.muted }, activeSegmentText: { color: colors.emerald }, sectionRule: { height: 1, backgroundColor: colors.border, marginTop: 17 }, list: { paddingHorizontal: 20, paddingBottom: 18 }, emptyList: { flexGrow: 1, paddingHorizontal: 20 }, collectionCard: { backgroundColor: '#FFF', borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 13, marginTop: 10, flexDirection: 'row', alignItems: 'center' }, cardAvatar: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#DFF5E8', alignItems: 'center', justifyContent: 'center' }, campaignAvatar: { backgroundColor: '#FFF1D6' }, templateAvatar: { backgroundColor: '#E5E9FF' }, cardAvatarText: { color: colors.ink, fontSize: 16, fontWeight: '800' }, cardBody: { flex: 1, marginLeft: 12 }, cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, cardDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, cardMeta: { color: colors.emerald, fontSize: 10, fontWeight: '800', letterSpacing: .5, textTransform: 'uppercase', marginTop: 6 }, cardArrow: { width: 24, alignItems: 'flex-end' }, cardArrowText: { color: '#9BA9A2', fontSize: 28, lineHeight: 28 }, tabBar: { height: 72, paddingHorizontal: 7, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-around' }, tab: { minWidth: 55, flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' }, tabGlyph: { height: 23, minWidth: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, activeGlyph: { backgroundColor: colors.mint }, tabGlyphText: { fontSize: 8, fontWeight: '900', color: colors.muted }, activeGlyphText: { color: colors.emerald }, tabText: { fontSize: 10, color: colors.muted, fontWeight: '700', marginTop: 3 }, activeTabText: { color: colors.emerald }, badge: { position: 'absolute', top: 8, right: 7, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#FFF', fontSize: 8, fontWeight: '800' }, dashboard: { padding: 20, paddingBottom: 28 }, overview: { backgroundColor: colors.ink, borderRadius: 21, padding: 20, marginTop: 20 }, overviewLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#A5C5B8' }, balance: { fontSize: 31, fontWeight: '800', color: '#FFF', marginTop: 7 }, overviewHint: { fontSize: 12, color: '#C8DDD5', marginTop: 6 }, metrics: { flexDirection: 'row', marginTop: 12 }, metric: { flex: 1, backgroundColor: '#E2F5EA', borderRadius: 17, padding: 15, marginRight: 6 }, metricBlue: { backgroundColor: '#E9EDFF', marginRight: 0, marginLeft: 6 }, metricValue: { fontSize: 23, fontWeight: '800', color: colors.ink }, metricLabel: { fontSize: 11, color: colors.muted, marginTop: 3 }, sectionTitle: { fontSize: 16, color: colors.ink, fontWeight: '800', marginTop: 24, marginBottom: 4 }, actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, actionCard: { width: '48.5%', minHeight: 102, backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 14, marginTop: 10 }, actionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink }, actionNote: { fontSize: 11, color: colors.muted, lineHeight: 15, marginTop: 5, width: '80%' }, actionArrow: { position: 'absolute', right: 13, bottom: 10, fontSize: 21, color: colors.emerald }, projectCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 17, marginTop: 23 }, projectCardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.muted }, projectCardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 8 }, projectCardDetail: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 5 }, signOut: { alignSelf: 'center', padding: 18, marginTop: 6 }, signOutText: { color: colors.danger, fontWeight: '800', fontSize: 13 }, emptyScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#F6F8F7' }, emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint }, emptyIconText: { fontSize: 30, fontWeight: '900', color: colors.emerald }, emptyTitle: { fontSize: 23, fontWeight: '800', color: colors.ink, marginTop: 20 }, emptyCopy: { fontSize: 14, color: colors.muted, lineHeight: 21, textAlign: 'center', marginTop: 8 }, primaryButton: { height: 50, minWidth: 145, marginTop: 24, borderRadius: 14, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: '#FFF', fontWeight: '800' }
});
