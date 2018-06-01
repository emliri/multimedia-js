export type MimeType = string;
export type MimeTypes = MimeType[];

/*
export function isValidMimeTypeString(mimeType: string) {
  //
}
*/

export enum CommonMimeTypes {
  AUDIO_MP3 = 'audio/mpeg',
  AUDIO_OPUS = 'audio/opus',
  VIDEO_MP4 = 'video/mp4',
  VIDEO_AVC = 'video/avc',
  VIDEO_AAC = 'video/aac'
}

export const UNKNOWN_MIMETYPE = 'unknown/*';

// TODO: parse & validate mime-types
/**
 * @see https://en.wikipedia.org/wiki/Media_type
 *
 */

export function appendCodecsToMimeType(mimeType: MimeType, codec: string[]): string {
  return mimeType
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

export class PayloadDetails {
    // TBD
}

export class PayloadDescriptor {
    mimeType: MimeType;

    sampleDuration: number;
    sampleDepth: SampleDepth;

    dataFormat: PayloadDataFormat;
    dataLayout: PayloadDataLayout;

    private details_: PayloadDetails;

    constructor(mimeType: string, sampleDuration: number = NaN, sampleDepth: number = NaN) {

        this.mimeType = mimeType;
        this.sampleDuration = sampleDuration;
        this.sampleDepth = sampleDepth;

        this.dataFormat = PayloadDataFormat.UNSPECIFIED;
        this.dataLayout = PayloadDataLayout.UNSPECIFIED;

        this.details_ = new PayloadDetails();
    }

    details(): PayloadDetails {
        return this.details_;
    }

    getSampleSize(): number {
        return this.sampleDepth / 8;
    }

    getSamplingRate(): number {
        return (1 / this.sampleDuration);
    }
}
