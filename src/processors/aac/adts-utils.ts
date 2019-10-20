export type ADTSHeaderInfo = {
  headerLength: 7 | 9
  frameLength: number
  timestamp: number
}

export const ADTS_SAMPLING_RATES_TABLE = [
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
];

export function isAacADTSHeaderPattern (data: Uint8Array, offset: number): boolean {
  // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
  // Layer bits (position 14 and 15) in header should be always 0 for ADTS
  // More info https://wiki.multimedia.cx/index.php?title=ADTS
  // (0xf6 is masking the X00X pattern)
  return data[offset] === 0xff && (data[offset + 1] & 0xf6) === 0xf0;
}

export function getADTSHeaderLength (data: Uint8Array, offset: number): 7 | 9 {
  return (data[offset + 1] & 0x01 ? 7 : 9);
}

export function getFullAACFrameLength (data: Uint8Array, offset: number): number {
  return ((data[offset + 3] & 0x03) << 11) |
          (data[offset + 4] << 3) |
          ((data[offset + 5] & 0xE0) >>> 5);
}

export function isADTSHeader (data: Uint8Array, offset: number): boolean {
  if (offset + 1 < data.length && isAacADTSHeaderPattern(data, offset)) {
    return true;
  }

  return false;
}

export function probeAACByteStream (data, offset): boolean {
  // same as isHeader but we also check that ADTS frame follows last ADTS frame
  // or end of data is reached
  if (offset + 1 < data.length && isAacADTSHeaderPattern(data, offset)) {
    // ADTS header Length
    let headerLength = getADTSHeaderLength(data, offset);
    // ADTS frame Length
    let frameLength = <number> headerLength;
    if (offset + 5 < data.length) {
      frameLength = getFullAACFrameLength(data, offset);
    }

    let newOffset = offset + frameLength;
    if (newOffset === data.length || (newOffset + 1 < data.length && isAacADTSHeaderPattern(data, newOffset))) {
      return true;
    }
  }
  return false;
}

export function getAACFrameDurationInMPEGTSClockTicks (samplerate: number): number {
  return 1024 * 90000 / samplerate;
}

export function parseAacADTSHeaderInfo (
  data: Uint8Array,
  offset: number,
  pts: number,
  frameIndex: number,
  frameDuration: number): ADTSHeaderInfo | null {
  let headerLength;
  let frameLength;
  let timestamp;
  let length = data.length;

  // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
  headerLength = getADTSHeaderLength(data, offset);

  // retrieve frame size
  frameLength = getFullAACFrameLength(data, offset);
  frameLength -= headerLength;

  if ((frameLength > 0) && ((offset + headerLength + frameLength) <= length)) {
    timestamp = pts + frameIndex * frameDuration;

    return {
      headerLength,
      frameLength,
      timestamp
    };
  }

  return null;
}
