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
  audioTrackId: number;
  videoTrackId: number;
  audioBaseDts: number;
  videoBaseDts: number;
}


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
