import type { AudioSet } from 'react-native-nitro-sound';

export type VoiceNoteSound = ReturnType<
  typeof import('react-native-nitro-sound').createSound
>;

export type VoiceNotePlatform = 'android' | 'ios';

export function getVoiceNoteFormat(platform: VoiceNotePlatform) {
  return platform === 'android'
    ? { extension: 'aac', mimeType: 'audio/aac' }
    : { extension: 'm4a', mimeType: 'audio/mp4' };
}

export const MAX_VOICE_NOTE_SIZE_BYTES = 16 * 1024 * 1024;

export function getVoiceNoteAudioSet(platform: VoiceNotePlatform): AudioSet {
  const commonSettings: AudioSet = {
    AudioQuality: 'low',
    AudioEncodingBitRate: 64000,
    AudioSamplingRate: 22050,
    AudioChannels: 1,
  };

  if (platform === 'android') {
    const soundModule =
      require('react-native-nitro-sound') as typeof import('react-native-nitro-sound');
    return {
      ...commonSettings,
      AudioSourceAndroid: soundModule.AudioSourceAndroidType.MIC,
      OutputFormatAndroid: soundModule.OutputFormatAndroidType.AAC_ADTS,
      AudioEncoderAndroid: soundModule.AudioEncoderAndroidType.AAC,
    };
  }

  return { ...commonSettings, AVFormatIDKeyIOS: 'aac' };
}

export function createVoiceNoteSound(): VoiceNoteSound {
  const soundModule =
    require('react-native-nitro-sound') as typeof import('react-native-nitro-sound');
  return soundModule.createSound();
}

export function validateVoiceNoteSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('The voice note could not be read or is empty.');
  }
  if (sizeBytes > MAX_VOICE_NOTE_SIZE_BYTES) {
    throw new Error('Audio attachments must be 16 MB or smaller.');
  }
}
