export const AAC_SAMPLES_PER_FRAME = 1024 as const;

export const SOUND_CODECS = [
  'PCM',
  'ADPCM',
  'MP3',
  'PCM le',
  'Nellymouser16',
  'Nellymouser8',
  'Nellymouser',
  'G.711 A-law',
  'G.711 mu-law',
  null, // ???
  'AAC',
  'Speex',
  'MP3 8khz'
] as const;

export const MP3_SOUND_CODEC_ID = 2 as const;
export const AAC_SOUND_CODEC_ID = 10 as const;

export const VIDEOCODECS = [
  null,
  'JPEG',
  'Sorenson',
  'Screen',
  'VP6',
  'VP6 alpha',
  'Screen2',
  'AVC'] as const;

export const VP6_VIDEO_CODEC_ID = 4 as const;
export const AVC_VIDEO_CODEC_ID = 7 as const;
