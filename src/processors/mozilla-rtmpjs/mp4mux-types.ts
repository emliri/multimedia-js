export const AAC_SAMPLING_FREQUENCIES = [
  96000,
  88200,
  64000,
  48000,
  44100,
  32000,
  24000,
  22050,
  16000,
  12000,
  11025,
  8000,
  7350
]; // FIXME: as const

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

export type AudioFrame = {
  decodingTime: number,
  compositionTime: number,
  codecDescription: string;
  codecId: number;
  data: Uint8Array;
  rate: number;
  size: number;
  channels: number;
  samples: number;
  type: AudioFrameType;
  sampleDescriptionIndex: number;
}

export enum AudioFrameType {
  HEADER = 0,
  RAW = 1,
}

export type AudioDetails = {
  sampleRate: number,
  sampleDepth: number,
  samplesPerFrame: number,
  numChannels: number
}

export const VIDEOCODECS = [null, 'JPEG', 'Sorenson', 'Screen', 'VP6', 'VP6 alpha', 'Screen2', 'AVC'];
export const VP6_VIDEO_CODEC_ID = 4;
export const AVC_VIDEO_CODEC_ID = 7;

export type VideoFrame = {
  frameFlag: VideoFrameFlag;
  codecId: number;
  codecDescription: string;
  data: Uint8Array;
  type: VideoFrameType; // TODO: get rid of this
  decodingTime: number,
  compositionTime: number;
  horizontalOffset?: number;
  verticalOffset?: number;
  sampleDescriptionIndex: number;
}

export enum VideoFrameFlag {
  KEY = 1,
  INTRA = 2,
}

export enum VideoFrameType {
  HEADER = 0,
  NALU = 1
}

export enum MP4MuxFrameType {
  AUDIO = 8,
  VIDEO = 9 // legacy support numbers (for FLV package! :D), not sure if can be replaced
}

export type MP4Track = {
  // general
  codecDescription?: string;
  codecId: number;
  timescale: number;
  duration: number, // -1 for unknown

  // video
  framerate?: number;
  width?: number;
  height?: number;

  // audio
  samplerate?: number;
  channels?: number;
  samplesize?: number;
  audioObjectType?: number;

  // audio/subs
  language?: string;
}

export type MP4MovieMetadata = {
  tracks: MP4Track[];
  duration: number;
  audioTrackId: number;
  videoTrackId: number;
  audioBaseDts: number;
  videoBaseDts: number;
}
