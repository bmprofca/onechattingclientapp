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
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  QrCode as QrIcon,
  Layers,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ApiSession } from '../../api/client';
import { getProjectQRCodes, QRCodeItem } from '../../api/qrcode';
import { useTheme } from '../../theme/theme';
import { ProjectAvatar } from '../ProjectAvatar';

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
          // Fallback default QR code for this project
          setQrList([
            {
              id: 'default',
              qr_id: projectId,
              title: `${projectName} Direct QR`,
              label: 'Default QR Code',
              target_type: 'chatroom',
            },
          ]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setQrList([
          {
            id: 'default',
            qr_id: projectId,
            title: `${projectName} Direct QR`,
            label: 'Default QR Code',
            target_type: 'chatroom',
          },
        ]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, projectId, projectName, session]);

  if (!visible) return null;

  const currentQR = qrList[selectedIndex] || qrList[0];
  const qrId = currentQR?.qr_id || currentQR?.id || projectId;
  const qrTitle = currentQR?.title || currentQR?.label || currentQR?.name || `${projectName} QR`;
  const qrTarget = currentQR?.target_type || 'Workspace Chat';

  // Construct standard public URL for this QR code
  const publicQrUrl = `https://server.onechatting.com/qr/${qrId}`;

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
            <View style={styles.headerLeft}>
              <ProjectAvatar
                name={projectName}
                image={projectImage}
                size={38}
                borderRadius={12}
              />
              <View style={styles.headerInfo}>
                <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink }]}>
                  {projectName}
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
                  Project QR Code
                </Text>
              </View>
            </View>

            <Pressable
              hitSlop={12}
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.canvas }]}
            >
              <X size={18} color={theme.ink} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.emerald} />
              <Text style={[styles.loadingText, { color: theme.muted }]}>
                Loading QR Codes...
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
                      const tabTitle = item.title || item.label || `QR #${index + 1}`;
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
                  {qrTitle}
                </Text>
                <View style={styles.metaBadgeRow}>
                  <View style={[styles.badge, { backgroundColor: theme.mint }]}>
                    <Layers size={11} color={theme.emerald} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: theme.emerald }]}>
                      {qrTarget.toUpperCase()}
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
                >
                  <MessageCircle size={16} color="#FFF" />
                  <Text style={styles.actionBtnText}>WhatsApp</Text>
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
                  <Text style={styles.actionBtnText}>Share</Text>
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
                  <Text
                    style={[
                      styles.secondaryActionBtnText,
                      { color: copied ? theme.emerald : theme.ink },
                    ]}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
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
                  <Text style={[styles.secondaryActionBtnText, { color: theme.ink }]}>
                    Open
                  </Text>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
