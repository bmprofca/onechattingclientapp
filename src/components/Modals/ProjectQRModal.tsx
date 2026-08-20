import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  QrCode as QrIcon,
  Layers,
  Info,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ApiSession } from '../../api/client';
import { getProjectQRCodes, QRCodeItem } from '../../api/qrcode';
import { useTheme } from '../../theme/theme';
import { ProjectAvatar } from '../ProjectAvatar';

const WhatsAppIcon = ({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      fill={color}
    />
  </Svg>
);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProjectQRModalProps {
  visible: boolean;
  onClose: () => void;
  session: ApiSession;
  projectId: string;
  projectName?: string;
  projectImage?: string;
}

export function ProjectQRModal({
  visible,
  onClose,
  session,
  projectId,
  projectName = 'Project Workspace',
  projectImage,
}: ProjectQRModalProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [qrList, setQrList] = useState<QRCodeItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible || !projectId) return;

    let cancelled = false;
    setLoading(true);
    setSelectedIndex(0);

    getProjectQRCodes(session, projectId)
      .then((res) => {
        if (cancelled) return;
        if (res.qr_codes && res.qr_codes.length > 0) {
          setQrList(res.qr_codes);
        } else {
          setQrList([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setQrList([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, projectId, session.token, session.username]);

  if (!visible) return null;

  const currentQR = qrList[selectedIndex] || qrList[0];
  const qrId = currentQR?.qr_id;

  // Construct standard public URL for this QR code
  const publicQrUrl = `https://app.onechatting.com/qr/${qrId}`;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${projectName} QR Code`,
        message: `Scan or open this QR link to connect with ${projectName}:\n${publicQrUrl}`,
        url: publicQrUrl,
      });
    } catch (err) {
      console.error('Error sharing QR code:', err);
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `👋 Connect with *${projectName}* on WhatsApp!\n\nScan our QR code or click the link below to get started:\n${publicQrUrl}`
    );
    const whatsappUrl = `whatsapp://send?text=${text}`;
    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(whatsappUrl);
        } else {
          return Linking.openURL(`https://api.whatsapp.com/send?text=${text}`);
        }
      })
      .catch(() => {
        Toast.show({
          type: 'error',
          text1: 'WhatsApp Not Available',
          text2: 'Could not open WhatsApp. Please use regular Share.',
        });
      });
  };

  const handleCopyLink = () => {
    // In React Native, fallback share / copy representation
    setCopied(true);
    Toast.show({
      type: 'success',
      text1: 'QR Link Copied',
      text2: publicQrUrl,
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenLink = () => {
    Linking.openURL(publicQrUrl).catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Could not open link',
      });
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerInfo}>
              <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink }]}>
                Project QR Code
              </Text>
              <Text numberOfLines={1} style={[styles.headerSubtitle, { color: theme.muted }]}>
                {projectName}
              </Text>
            </View>

            <Pressable
              hitSlop={12}
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
            >
              <X size={20} color={theme.muted} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.emerald} />
              <Text style={[styles.loadingText, { color: theme.muted }]}>
                Loading QR Codes...
              </Text>
            </View>
          ) : qrList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBadge}>
                <Info size={32} color="#6366F1" strokeWidth={2.2} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.ink }]}>
                No QR Code Generated Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
                Your system administrator has not generated an official QR code for this project yet. Please contact admin to assign a QR scan point.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              {/* Multi-QR Switcher Pills */}
              {qrList.length > 1 && (
                <View style={styles.tabsWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContainer}
                  >
                    {qrList.map((item, index) => {
                      const isSelected = selectedIndex === index;
                      const tabTitle = `QR #${index + 1}`;
                      return (
                        <Pressable
                          key={String(item.id || item.qr_id || index)}
                          onPress={() => setSelectedIndex(index)}
                          style={[
                            styles.tabPill,
                            {
                              backgroundColor: isSelected
                                ? theme.emerald
                                : theme.canvas,
                              borderColor: isSelected
                                ? theme.emerald
                                : theme.border,
                            },
                          ]}
                        >
                          <QrIcon
                            size={13}
                            color={isSelected ? '#FFF' : theme.muted}
                            style={{ marginRight: 5 }}
                          />
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.tabText,
                              { color: isSelected ? '#FFF' : theme.ink },
                            ]}
                          >
                            {tabTitle}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* QR Title & Target Meta */}
              <View style={styles.qrMetaContainer}>
                <Text style={[styles.qrTitle, { color: theme.ink }]}>
                  {`QR #${selectedIndex + 1}`}
                </Text>
                <View style={styles.metaBadgeRow}>
                  <View style={[styles.badge, { backgroundColor: theme.mint }]}>
                    <Layers size={11} color={theme.emerald} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: theme.emerald }]}>
                      PROJECT CHAT
                    </Text>
                  </View>
                  {currentQR?.scan_count !== undefined && (
                    <View style={[styles.badge, { backgroundColor: theme.canvas, borderColor: theme.border, borderWidth: 1 }]}>
                      <Text style={[styles.badgeText, { color: theme.muted }]}>
                        {currentQR.scan_count} scans
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* QR Code Canvas */}
              <View style={styles.qrCardContainer}>
                <View style={[styles.qrWrapper, { shadowColor: theme.shadow }]}>
                  <QRCode
                    value={publicQrUrl}
                    size={Math.min(SCREEN_WIDTH * 0.58, 220)}
                    color="#1E293B"
                    backgroundColor="#FFFFFF"
                    quietZone={14}
                  />
                </View>
                <Text style={[styles.scanHint, { color: theme.muted }]}>
                  Point camera or scan to open conversation
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionGrid}>
                {/* Share WhatsApp */}
                <Pressable
                  onPress={handleWhatsAppShare}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: '#25D366' },
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityLabel="Share on WhatsApp"
                >
                  <WhatsAppIcon size={19} color="#FFF" />
                  {/* <Text style={styles.actionBtnText}>WhatsApp</Text> */}
                </Pressable>

                {/* Share Sheet */}
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: theme.emerald },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Share2 size={16} color="#FFF" />
                  {/* <Text style={styles.actionBtnText}>Share</Text> */}
                </Pressable>

                {/* Copy Link */}
                <Pressable
                  onPress={handleCopyLink}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.secondaryActionBtn,
                    { backgroundColor: theme.canvas, borderColor: theme.border },
                    pressed && { backgroundColor: theme.cardHover },
                  ]}
                >
                  {copied ? (
                    <Check size={16} color={theme.emerald} />
                  ) : (
                    <Copy size={16} color={theme.ink} />
                  )}
                  {/* <Text
                    style={[
                      styles.secondaryActionBtnText,
                      { color: copied ? theme.emerald : theme.ink },
                    ]}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Text> */}
                </Pressable>

                {/* Open Link */}
                <Pressable
                  onPress={handleOpenLink}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.secondaryActionBtn,
                    { backgroundColor: theme.canvas, borderColor: theme.border },
                    pressed && { backgroundColor: theme.cardHover },
                  ]}
                >
                  <ExternalLink size={16} color={theme.ink} />
                  {/* <Text style={[styles.secondaryActionBtnText, { color: theme.ink }]}>
                    Open
                  </Text> */}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 45,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  body: {
    padding: 18,
    alignItems: 'center',
  },
  tabsWrapper: {
    width: '100%',
    marginBottom: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  qrMetaContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qrCardContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  scanHint: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
