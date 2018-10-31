export type MimeType = string;
export type MimeTypes = MimeType[];

/*
export function isValidMimeTypeString(mimeType: string) {
  //
}
*/

// ADD common codec-strings

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types
 *
 */

export enum CommonMimeTypes {
  AUDIO_MP3 = 'audio/mpeg',
  AUDIO_AAC = 'audio/aac',
  AUDIO_OPUS = 'audio/opus',
  VIDEO_MP4 = 'video/mp4',
  VIDEO_AVC = 'video/avc',
  VIDEO_AAC = 'video/aac'
}

export const UNKNOWN_MIMETYPE = 'unknown/*';

// TODO: parse & validate mime-types and codec strings
/**
 * @see https://en.wikipedia.org/wiki/Media_type
 *
 */

export function appendCodecsToMimeType (mimeType: MimeType, codec: string[]): string {
  return mimeType;
}

export class PayloadDescriptor {

  elementaryStreamId: number;

  mimeType: MimeType;

  codec: string = null;

  sampleDuration: number;
  sampleDepth: SampleDepth;

  dataFormat: PayloadDataFormat;
  dataLayout: PayloadDataLayout;

  details: PayloadDetails = new PayloadDetails();

  constructor (mimeType: string, sampleDuration: number = NaN, sampleDepth: number = NaN) {
    this.mimeType = mimeType.toLowerCase();

    this.sampleDuration = sampleDuration;
    this.sampleDepth = sampleDepth;

    this.dataFormat = PayloadDataFormat.UNSPECIFIED;
    this.dataLayout = PayloadDataLayout.UNSPECIFIED;
  }

  getSampleSize (): number {
    return this.sampleDepth / 8;
  }

  getSamplingRate (): number {
    return (1 / this.sampleDuration);
  }
}

export class PayloadDetails {
  // TBD
  width: number
  height: number

  codecConfigurationData: Uint8Array | number[]
}


export class PayloadCodec {
  static isAvc(codec: string) {
    return codec.startsWith('avc1');
  }

  static isAac(codec: string) {
    return codec.startsWith('mp4a');
  }

  static isMp3(codec: string) {
    return codec.startsWith('mp3a');
  }
}

export enum PayloadDataFormat {
    UNSPECIFIED,
    S_LE,
    S_BE,
    U_LE,
    U_BE
}

export enum PayloadDataLayout {
    UNSPECIFIED,
    INTERLEAVED,
    PROGRESSIVE
}

export enum SampleDepth {
    UNSPECIFIED = 0,
    VARIABLE = Infinity,
    FOUR = 4,
    EIGHT = 8,
    TWELVE = 12,
    SIXTEEN = 16,
    THIRTYTWO = 32
}



