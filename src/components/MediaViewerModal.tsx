import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Alert,
  StatusBar,
  Share,
  PanResponder,
} from 'react-native';
import { X, Download, ExternalLink, FileText, ChevronLeft, ChevronRight } from 'lucide-react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { ScalePressable, FadeInView } from './animations';
import { openLink } from '../utils/openLink';
import Toast from '../ui/toast';

export type MediaViewerItem = {
  key: string;
  url: string;
  type: 'image' | 'video';
  name?: string;
};

type MediaViewerProps = {
  visible: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'document' | 'audio';
  mediaName?: string;
  galleryItems?: MediaViewerItem[];
  initialGalleryIndex?: number;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function MediaViewerModal({
  visible,
  onClose,
  mediaUrl,
  mediaType,
  mediaName,
  galleryItems = [],
  initialGalleryIndex = -1,
}: MediaViewerProps) {
  const [downloading, setDownloading] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [galleryIndex, setGalleryIndex] = useState(initialGalleryIndex);
  const galleryLengthRef = useRef(galleryItems.length);

  galleryLengthRef.current = galleryItems.length;

  useEffect(() => {
    setGalleryIndex(initialGalleryIndex);
  }, [initialGalleryIndex, visible]);

  const activeGalleryItem = galleryIndex >= 0 ? galleryItems[galleryIndex] : undefined;
  const activeMediaUrl = activeGalleryItem?.url || mediaUrl;
  const activeMediaType = activeGalleryItem?.type || mediaType;
  const activeMediaName = activeGalleryItem?.name || mediaName;
  const fileName = activeMediaName || activeMediaUrl.split('/').pop() || 'download';

  useEffect(() => {
    setImgLoading(true);
  }, [activeMediaUrl]);

  const galleryPanResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      galleryLengthRef.current > 1 &&
      Math.abs(gesture.dx) > 24 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -45) {
        setGalleryIndex(current => Math.min(current + 1, galleryLengthRef.current - 1));
      } else if (gesture.dx > 45) {
        setGalleryIndex(current => Math.max(current - 1, 0));
      }
    },
  })).current;

  // --- Android: download to public Downloads via DownloadManager ---
  const saveAndroid = async () => {
    const sdkVersion = Platform.Version as number;

    if (sdkVersion < 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs storage permission to save files.',
          buttonPositive: 'OK',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Cannot save without storage permission.');
        return;
      }
    } else {
      // Android 13+: request notification permission so the download
      // notification (and completion tracking) works reliably.
      try {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      } catch {
        // Non-fatal if this fails — download can still proceed.
      }
    }

    const downloadDir = ReactNativeBlobUtil.fs.dirs.DownloadDir;
    const filePath = `${downloadDir}/${fileName}`;

    const task = ReactNativeBlobUtil.config({
      path: filePath,
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        path: filePath,
        description: 'Downloading file',
        title: fileName,
      },
    }).fetch('GET', activeMediaUrl);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Download timed out after 30s')), 30000),
    );

    await Promise.race([task, timeout]);
    Toast.show({
      type: 'success',
      text1: 'Download complete',
      text2: `${fileName} saved to Downloads.`,
    });
  };

  // --- iOS: images/video go to Photos, documents go through Share sheet ---
  const saveIOS = async () => {
    // Fetch into a temp cache location first
    const res = await ReactNativeBlobUtil.config({ fileCache: true }).fetch(
      'GET',
      activeMediaUrl,
    );
    const tmpPath = res.path();

    if (activeMediaType === 'image' || activeMediaType === 'video') {
      // Save directly into Photos — this is the only place iOS users expect
      // media to land, and it needs NSPhotoLibraryAddUsageDescription in Info.plist.
      await CameraRoll.save(`file://${tmpPath}`, {
        type: activeMediaType === 'video' ? 'video' : 'photo',
      });
      Alert.alert('Saved!', 'Saved to your Photos.');
    } else {
      // Documents/audio: no equivalent of a "Downloads" folder on iOS —
      // hand off to the native share sheet so the user can save to Files,
      // AirDrop, etc.
      await Share.share({ url: `file://${tmpPath}`, title: fileName });
    }
  };

  const handleSave = async () => {
    if (!activeMediaUrl) return;
    setDownloading(true);
    try {
      if (Platform.OS === 'android') {
        await saveAndroid();
      } else {
        await saveIOS();
      }
    } catch (err: any) {
      console.warn('Download error', err);
      Alert.alert('Download Failed', err?.message || 'Unknown error');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenExternal = () => {
    if (!activeMediaUrl) return;
    openLink(activeMediaUrl).catch(() =>
      Alert.alert('Cannot open', 'Could not open this file.'),
    );
  };

  const renderContent = () => {
    if (activeMediaType === 'image') {
      return (
        <View style={styles.imageContainer}>
          {imgLoading && (
            <ActivityIndicator size="large" color="#10B981" style={styles.imgLoader} />
          )}
          <Image
            source={{ uri: activeMediaUrl }}
            style={styles.fullImage}
            resizeMode="contain"
            onLoadEnd={() => setImgLoading(false)}
          />
        </View>
      );
    }

    if (activeMediaType === 'video') {
      return (
        <View style={styles.placeholderContainer}>
          <View style={styles.videoIconCircle}>
            <Text style={styles.videoPlayIcon}>▶</Text>
          </View>
          <Text style={styles.placeholderTitle}>{fileName}</Text>
          <Text style={styles.placeholderSub}>Tap Open to play this video</Text>
        </View>
      );
    }

    return (
      <View style={styles.placeholderContainer}>
        <View style={styles.docIconCircle}>
          <FileText size={48} color="#FFF" />
        </View>
        <Text style={styles.placeholderTitle} numberOfLines={2}>
          {fileName}
        </Text>
        <Text style={styles.placeholderSub}>
          {activeMediaType === 'audio' ? 'Audio file' : 'Document file'}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <View style={styles.container}>
        <FadeInView direction="down" distance={20} duration={300} style={styles.topBar}>
          <ScalePressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={26} color="#FFF" />
          </ScalePressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={{ width: 36 }} />
        </FadeInView>

        <View style={styles.body} {...galleryPanResponder.panHandlers}>
          <FadeInView scale startScale={0.92} duration={350} style={StyleSheet.absoluteFill}>
            {renderContent()}
          </FadeInView>
          {galleryItems.length > 1 && galleryIndex >= 0 ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous media"
                disabled={galleryIndex === 0}
                onPress={() => setGalleryIndex(index => Math.max(index - 1, 0))}
                style={[styles.galleryArrow, styles.galleryArrowLeft, galleryIndex === 0 && styles.galleryArrowDisabled]}
              >
                <ChevronLeft size={24} color="#FFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next media"
                disabled={galleryIndex === galleryItems.length - 1}
                onPress={() => setGalleryIndex(index => Math.min(index + 1, galleryItems.length - 1))}
                style={[styles.galleryArrow, styles.galleryArrowRight, galleryIndex === galleryItems.length - 1 && styles.galleryArrowDisabled]}
              >
                <ChevronRight size={24} color="#FFF" />
              </Pressable>
              <Text style={styles.galleryCounter}>
                {galleryIndex + 1} / {galleryItems.length}
              </Text>
            </>
          ) : null}
        </View>

        <FadeInView direction="up" distance={20} duration={300} style={styles.bottomBar}>
          <Pressable style={[styles.actionBtn, styles.openBtn]} onPress={handleOpenExternal}>
            <ExternalLink size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Open</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.saveBtn]}
            onPress={handleSave}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Download size={20} color="#FFF" />
            )}
            <Text style={styles.actionBtnText}>
              {downloading ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </FadeInView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  galleryArrow: {
    position: 'absolute',
    top: '50%',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  galleryArrowLeft: { left: 12 },
  galleryArrowRight: { right: 12 },
  galleryArrowDisabled: { opacity: 0.35 },
  galleryCounter: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  imageContainer: { flex: 1, width: SCREEN_W, justifyContent: 'center', alignItems: 'center' },
  imgLoader: { position: 'absolute', zIndex: 1 },
  fullImage: { width: SCREEN_W, height: SCREEN_H * 0.7 },
  placeholderContainer: { alignItems: 'center', paddingHorizontal: 32 },
  videoIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  videoPlayIcon: { fontSize: 32, color: '#FFF' },
  docIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  placeholderTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  openBtn: { backgroundColor: '#374151' },
  saveBtn: { backgroundColor: '#10B981' },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});