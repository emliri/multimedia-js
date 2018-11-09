/**
 * @module
 * MPEG-Audio parser
 */

export const MPEGAudioSamplingRates: number[] = [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000];

export const MPEGAudioBitratesTable: number[] = [ 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448,
  32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384,
  32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
  32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256,
  8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160 ];

export type MPEGAudioHeader = {
    sampleRate: number
    channelCount: number
    frameLength: number
};

export type MPEGAudioFrame = {
    headerRef: MPEGAudioHeader,
    data: Uint8Array
    frameDuration: number
    sampleDuration: number
};

export const SAMPLES_PER_FRAME = 1152;

export class MPEGAudioParser {
  static parseFrame (data: Uint8Array, offset: number): MPEGAudioFrame {
    // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
    if (offset + 24 > data.length) {
      return null;
    }

    const header = MPEGAudioParser.parseHeader(data, offset);

    if (header && offset + header.frameLength <= data.length) {
      const sampleDuration = 1 / header.sampleRate;
      const frameDuration = SAMPLES_PER_FRAME * sampleDuration;

      return {
        headerRef: header,
        data: data.subarray(offset, offset + header.frameLength),
        frameDuration,
        sampleDuration
      };
    }

    return null;
  }

  static parseHeader (data: Uint8Array, offset: number): MPEGAudioHeader {
    let headerB = (data[offset + 1] >> 3) & 3;
    let headerC = (data[offset + 1] >> 1) & 3;
    let headerE = (data[offset + 2] >> 4) & 15;
    let headerF = (data[offset + 2] >> 2) & 3;
    let headerG = !!(data[offset + 2] & 2);

    if (headerB !== 1 && headerE !== 0 && headerE !== 15 && headerF !== 3) {
      let columnInBitrates = headerB === 3 ? (3 - headerC) : (headerC === 3 ? 3 : 4);
      let bitRate = MPEGAudioBitratesTable[columnInBitrates * 14 + headerE - 1] * 1000;
      let columnInSampleRates = headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
      let sampleRate = MPEGAudioSamplingRates[columnInSampleRates * 3 + headerF];
      let padding = headerG ? 1 : 0;
      let channelCount = data[offset + 3] >> 6 === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
      let frameLength = headerC === 3
        ? ((headerB === 3 ? 12 : 6) * bitRate / sampleRate + padding) << 2
        : ((headerB === 3 ? 144 : 72) * bitRate / sampleRate + padding) | 0;

      return { sampleRate, channelCount, frameLength };
    }

    return null;
  }

  static isHeaderPattern (data: Uint8Array, offset: number): boolean {
    return data[offset] === 0xff &&
            (data[offset + 1] & 0xe0) === 0xe0 &&
            (data[offset + 1] & 0x06) !== 0x00;
  }

  static isHeader (data: Uint8Array, offset): boolean {
    // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
    // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
    // More info http://www.mp3-tech.org/programmer/frame_header.html
    if (offset + 1 < data.length && MPEGAudioParser.isHeaderPattern(data, offset)) {
      return true;
    }
    return false;
  }

  static probe (data: Uint8Array, offset: number): boolean {
    // same as isHeader but we also check that MPEG frame follows last MPEG frame
    // or end of data is reached
    if (offset + 1 < data.length && MPEGAudioParser.isHeaderPattern(data, offset)) {
      // MPEG header Length
      let headerLength = 4;
      // MPEG frame Length
      let header = MPEGAudioParser.parseHeader(data, offset);
      let frameLength = headerLength;
      if (header && header.frameLength) {
        frameLength = header.frameLength;
      }
      let newOffset = offset + frameLength;
      if (newOffset === data.length || (newOffset + 1 < data.length && MPEGAudioParser.isHeaderPattern(data, newOffset))) {
        return true;
      }
    }
    return false;
  }
}
