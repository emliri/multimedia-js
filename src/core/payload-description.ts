import { isIntegerIEEE754, isInteger } from "../common-utils";

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

export enum MimetypePrefix {
  AUDIO = 'audio',
  VIDEO = 'video',
  TEXT = 'text',
  APPLICATION = 'application'
}

export const UNKNOWN_MIMETYPE = 'unknown/*';

// TODO: parse & validate mime-types and codec strings
/**
 * @see https://en.wikipedia.org/wiki/Media_type
 *
 */

/**
 *
 * @param mimeType
 * @param codec
 * @returns example: 'video/mp4; codecs=avc1.64001f'
 * // TODO: for several codecs in one container
 */
function appendCodecToMimeType (mimeType: MimeType, codec: string): string {
  return mimeType + '; codecs=' + codec;
}

function doesMimetypeHaveCodec(mimeType: string): boolean {
  return mimeType.indexOf('codecs=') >= 0;
}

export class PayloadDescriptor {
  /**
   * mime-type if defined
   */
  readonly mimeType: MimeType = null;

  /**
   * unit-less factor to deal with arbitrary integer sample-rates without loosing precision [1]
   */
  readonly sampleDurationNumerator: number;

  /**
   * integer bit-depth of one sample
   */
  readonly sampleDepth: SampleBitDepth = SampleBitDepth.UNSPECIFIED;

  /**
   * Hertz [Hz]
   */
  readonly sampleRateInteger: number;

  /**
   * data format/layout applicable for raw signal packets
   */
  readonly dataFormat: PayloadDataFormat = PayloadDataFormat.UNSPECIFIED;
  readonly dataLayout: PayloadDataLayout = PayloadDataLayout.UNSPECIFIED;

  /**
   * payload specific details (applicable to audio/video/text etc only e.g or codec-data related)
   */
  details: PayloadDetails = new PayloadDetails();

  elementaryStreamId: number = NaN; // FIXME: make this a string

  /**
   * codec (if applicable)
   */
  codec: string = null;

  constructor (mimeType: string,
    sampleRateInteger: number = 0,
    sampleDepth: number = 0,
    sampleDurationNumerator: number = 1) {

    if (!isIntegerIEEE754(sampleRateInteger) || !isInteger(sampleDurationNumerator)) {
      throw new Error(`sample-rate has to be safe-int (=${sampleRateInteger}) and duration-numerator has to be int too (=${this.sampleDurationNumerator}).`);
    }

    this.mimeType = mimeType.toLowerCase();

    this.sampleDurationNumerator = sampleDurationNumerator;
    this.sampleDepth = sampleDepth;
    this.sampleRateInteger = sampleRateInteger;

    this.dataFormat = PayloadDataFormat.UNSPECIFIED;
    this.dataLayout = PayloadDataLayout.UNSPECIFIED;
  }

  // TODO: put mime-type specific stuff in child object that specializes on mime-types?

  getFullMimeType(): string {
    if (!this.codec) {
      return this.mimeType;
    }
    if (doesMimetypeHaveCodec(this.mimeType)) { // FIXME: we should maybe rather throw here
      return this.mimeType;
    }
    return appendCodecToMimeType(this.mimeType, this.codec);
  }

  hasCodec(): boolean {
    return !!this.codec;
  }

  /**
   * Sample-duration in normal units ([1/Hz] <=> [s])
   *
   * By default the sampleRate is expected to be in 1*Hz. The unit to expect can be scaled using
   * the optional unit-less numerator property to N*Hz. Meaning that the unit is not 1/[s] anymore but 1/(N*[s]),
   * representing the number of sample in N seconds.
   *
   * That means that any sample-rates of the form no-of-samples-per-N-seconds [Hz],
   * where no-of-samples and N is should be integers, can be represented without precision loss.
   *
   * Also floating point values may be used but this may yield precision loss when computing the duration here.
   */
  getSampleDuration() {
    return this.sampleDurationNumerator / this.sampleRateInteger;
  }

  /**
   * Sampling-rate in normal units ([Hz] <=> [1/s])
   *
   * see getSampleDuration, simply the inverted value
   */
  getSamplingRate (): number {
    return this.sampleRateInteger / this.sampleDurationNumerator;
  }

  /**
   * Returns size of one sample in bytes
   */
  getSampleSize(): number {
    return this.sampleDepth / 8;
  }

  isAudio() {
    return this.mimeType.startsWith('audio/');
  }

  isVideo() {
    return this.mimeType.startsWith('video/');
  }

  isText() {
    return this.mimeType.startsWith('text/');
  }

  isImage() {
    return this.mimeType.startsWith('image/');
  }

  isApplicationSpecific() {
    return this.mimeType.startsWith('application/');
  }

  isFont() {
    return this.mimeType.startsWith('font/');
  }

  isJson() {
    return this.mimeType === ('application/json');
  }

  isXml() {
    return this.mimeType === ('application/xml');
  }

  toString() {
    return `[<${this.mimeType} codec="${this.codec}"> @${this.getSamplingRate()}[Hz]|1/(${this.getSampleDuration().toExponential()}[s]) * ${this.sampleDepth}bit #{${this.details.toString()}}]`;
  }
}

export class PayloadDetails {

  /*
  clone(details: PayloadDetails) {

  }
  */

  // place to put generic codec init-data // TODO: get rid of number[] here
  codecConfigurationData: Uint8Array | number[] = null

  // video
  width: number = 0;
  height: number = 0;

  // color-domains/channels

  // audio

  samplesPerFrame: number = 1;
  numChannels: number = 0
  constantBitrate: number = NaN;

  // text
  // ...

  // time-vs-frequency domains
  // ...

  toString() {
    return `width=${this.width}[px];height=${this.height}[px];samplesPerFrame=${this.samplesPerFrame};cbr=${this.constantBitrate}[b/s];numChannels=${this.numChannels};codecConfigSize=${this.codecConfigurationData ? this.codecConfigurationData.length : 0}`
  }
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

export enum SampleBitDepth {
  UNSPECIFIED = NaN,
  VARIABLE = 0,
  FOUR = 4,
  EIGHT = 8,
  TWELVE = 12,
  SIXTEEN = 16,
  THIRTYTWO = 32
}



