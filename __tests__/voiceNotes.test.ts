import {
  getVoiceNoteAudioSet,
  getVoiceNoteFormat,
  MAX_VOICE_NOTE_SIZE_BYTES,
  validateVoiceNoteSize,
} from '../src/services/voiceNotes';

jest.mock('react-native-nitro-sound', () => ({
  AudioSourceAndroidType: { MIC: 1 },
  OutputFormatAndroidType: { AAC_ADTS: 6 },
  AudioEncoderAndroidType: { AAC: 3 },
}));

describe('getVoiceNoteFormat', () => {
  it('uses an audio MIME type for both native recording formats', () => {
    expect(getVoiceNoteFormat('android')).toEqual({
      extension: 'aac',
      mimeType: 'audio/aac',
    });
    expect(getVoiceNoteFormat('ios')).toEqual({
      extension: 'm4a',
      mimeType: 'audio/mp4',
    });
  });
});

describe('getVoiceNoteAudioSet', () => {
  it('records Android voice notes using the AAC ADTS container', () => {
    expect(getVoiceNoteAudioSet('android')).toMatchObject({
      AudioSourceAndroid: 1,
      OutputFormatAndroid: 6,
      AudioEncoderAndroid: 3,
    });
  });
});

describe('validateVoiceNoteSize', () => {
  it('accepts a non-empty voice note at the upload limit', () => {
    expect(() =>
      validateVoiceNoteSize(MAX_VOICE_NOTE_SIZE_BYTES),
    ).not.toThrow();
  });

  it('rejects empty recordings and files above the upload limit', () => {
    expect(() => validateVoiceNoteSize(0)).toThrow('empty');
    expect(() => validateVoiceNoteSize(MAX_VOICE_NOTE_SIZE_BYTES + 1)).toThrow(
      '16 MB',
    );
  });
});
