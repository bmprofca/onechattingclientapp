import React, { useState } from 'react';
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
  Linking,
} from 'react-native';
import { X, Download, ExternalLink, FileText } from 'lucide-react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ScalePressable, FadeInView } from './animations';

type MediaViewerProps = {
  visible: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'document' | 'audio';
  mediaName?: string;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function MediaViewerModal({
  visible,
  onClose,
  mediaUrl,
  mediaType,
  mediaName,
}: MediaViewerProps) {
  const [downloading, setDownloading] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const fileName = mediaName || mediaUrl.split('/').pop() || 'download';

  const handleSave = async () => {
    if (!mediaUrl) return;
    setDownloading(true);
    try {
      // Request storage permission on Android
      if (Platform.OS === 'android') {
        const sdkVersion = Platform.Version;
        if (typeof sdkVersion === 'number' && sdkVersion < 33) {
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
        }
      }

      const downloadDir = Platform.OS === 'android'
        ? ReactNativeBlobUtil.fs.dirs.DownloadDir
        : ReactNativeBlobUtil.fs.dirs.DocumentDir;

      const filePath = `${downloadDir}/${fileName}`;

      await ReactNativeBlobUtil.config({
        fileCache: true,
        path: filePath,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          path: filePath,
          description: 'Downloading file',
          title: fileName,
        },
      }).fetch('GET', mediaUrl);

      Alert.alert('Saved!', `File saved to Downloads as ${fileName}`);
    } catch (err: any) {
      console.warn('Download error', err);
      Alert.alert('Download Failed', err?.message || 'Unknown error');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenExternal = () => {
    if (mediaUrl) {
      Linking.openURL(mediaUrl).catch(() =>
        Alert.alert('Cannot open', 'Could not open this file in browser.')
      );
    }
  };

  const renderContent = () => {
    if (mediaType === 'image') {
      return (
        <View style={styles.imageContainer}>
          {imgLoading && (
            <ActivityIndicator
              size="large"
              color="#10B981"
              style={styles.imgLoader}
            />
          )}
          <Image
            source={{ uri: mediaUrl }}
            style={styles.fullImage}
            resizeMode="contain"
            onLoadEnd={() => setImgLoading(false)}
          />
        </View>
      );
    }

    if (mediaType === 'video') {
      return (
        <View style={styles.placeholderContainer}>
          <View style={styles.videoIconCircle}>
            <Text style={styles.videoPlayIcon}>▶</Text>
          </View>
          <Text style={styles.placeholderTitle}>{fileName}</Text>
          <Text style={styles.placeholderSub}>Tap "Open" to play in your browser</Text>
        </View>
      );
    }

    // document / audio / fallback
    return (
      <View style={styles.placeholderContainer}>
        <View style={styles.docIconCircle}>
          <FileText size={48} color="#FFF" />
        </View>
        <Text style={styles.placeholderTitle} numberOfLines={2}>
          {fileName}
        </Text>
        <Text style={styles.placeholderSub}>
          {mediaType === 'audio' ? 'Audio file' : 'Document file'}
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
        {/* Top bar */}
        <FadeInView direction="down" distance={20} duration={300} style={styles.topBar}>
          <ScalePressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={26} color="#FFF" />
          </ScalePressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={{ width: 36 }} />
        </FadeInView>

        {/* Content */}
        <FadeInView scale={true} startScale={0.92} duration={350} style={styles.body}>
          {renderContent()}
        </FadeInView>

        {/* Bottom action bar */}
        <FadeInView direction="up" distance={20} duration={300} style={styles.bottomBar}>
          <ScalePressable
            style={[styles.actionBtn, styles.openBtn]}
            onPress={handleOpenExternal}
          >
            <ExternalLink size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Open</Text>
          </ScalePressable>

          <ScalePressable
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
          </ScalePressable>
        </FadeInView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    width: SCREEN_W,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.7,
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  videoIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  videoPlayIcon: {
    fontSize: 32,
    color: '#FFF',
  },
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
  placeholderSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
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
  openBtn: {
    backgroundColor: '#374151',
  },
  saveBtn: {
    backgroundColor: '#10B981',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
