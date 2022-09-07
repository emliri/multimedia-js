export const AAC_SAMPLES_PER_FRAME = 1024;

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
] as const;

export enum ADTS_PROFILE_MP4A_OBJECT_TYPE {
  NULL = 0,
  AAC_MAIN = 1,
  AAC_LC = 2,
  AAC_SSR = 3,
  AAC_LTP = 4
}

// todo add channel configs enum

/**

These are the channel configurations:

    0: Defined in AOT Specifc Config
    1: 1 channel: front-center
    2: 2 channels: front-left, front-right
    3: 3 channels: front-center, front-left, front-right
    4: 4 channels: front-center, front-left, front-right, back-center
    5: 5 channels: front-center, front-left, front-right, back-left, back-right
    6: 6 channels: front-center, front-left, front-right, back-left, back-right, LFE-channel
    7: 8 channels: front-center, front-left, front-right, side-left, side-right, back-left, back-right, LFE-channel
    8-15: Reserved

 */

export function getADTSSamplingRateIndex (samplingRateHz: number): number {
  const idx = ADTS_SAMPLING_RATES_TABLE.indexOf(samplingRateHz as any);
  if (idx < 0) throw new Error('Invalid ADTS sampling-rate: ' + samplingRateHz);
  return idx;
}

export function isADTSHeader (data: Uint8Array, offset: number): boolean {
  if (offset + 1 < data.length && isADTSHeaderPattern(data, offset)) {
    return true;
  }

  return false;
}

export function isADTSHeaderPattern (data: Uint8Array, offset: number): boolean {
  // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
  // Layer bits (position 14 and 15) in header should be always 0 for ADTS
  // More info https://wiki.multimedia.cx/index.php?title=ADTS
  // (0xf6 is masking the X00X pattern)
  return data[offset] === 0xff && (data[offset + 1] & 0xf6) === 0xf0;
}

export function getADTSHeaderLength (data: Uint8Array, offset: number): 7 | 9 {
  return (data[offset + 1] & 0x01 ? 7 : 9);
}

/**
 * @see https://wiki.multimedia.cx/index.php/ADTS
 */
export function makeADTSHeader (
  profile: ADTS_PROFILE_MP4A_OBJECT_TYPE, // @see https://wiki.multimedia.cx/index.php/MPEG-4_Audio#Audio_Object_Types
  samplingFrequencyIdx: number, // @see ADTS_SAMPLING_RATES_TABLE above
  channelConfig: number, // @see https://wiki.multimedia.cx/index.php/MPEG-4_Audio#Channel_Configurations
  payloadByteLength: number,
  nbOfFrames: number = 1,
  crcData: Uint8Array = null): Uint8Array {
  // todo: validate input values

  const data = new Uint8Array(crcData ? 9 : 7);

  data[0] = 0xFF; // sync word msbs
  // sync word lsbs + protection-absent flag, is 1 for no CRC
  data[1] = crcData ? 0xF00 : 0xF01;

  data[2] = (profile - 1) << 6;

  data[2] += (samplingFrequencyIdx << 2);

  data[2] += (0b100 & channelConfig) >> 2;

  data[3] = (channelConfig << 6);

  // todo check result is below 0x1FFF
  const frameLength = 0x1FFF & (payloadByteLength + data.byteLength);

  // pre-masked to select 13-lsbs
  data[3] += frameLength >> 11; // 13-12
  data[4] = frameLength >> 2; // 11-4
  data[5] = frameLength << 3; // 3-1

  // data[5] bits 1-5 are msbs and
  // data[6] bits 8-3 are lsbs of "buffer fullness" (11 bits).
  // (yet unclear from spec what it should be, nobody needs that here?)

  data[6] = 0b11 & (nbOfFrames - 1);

  if (crcData) {
    data[7] = crcData[0];
    data[8] = crcData[1];
  }

  return data;
}
