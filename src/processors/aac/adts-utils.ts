
export type Mp4AudioSpecificConfigInfo = {
  esdsAtomData: ArrayBuffer,
  sampleRate: number,
  channelCount: number
  codec: string
}

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

export function makeAACAudioSpecificConfigMp4DataFromADTSHeader (
  data: Uint8Array,
  offset: number,
  audioCodecMimetype?: string): Mp4AudioSpecificConfigInfo {
  if (!isAacADTSHeaderPattern(data, offset)) {
    throw new Error('Data is not an ADTS packet');
  }

  let adtsObjectType: number;
  let adtsSamplingIndex: number;
  let adtsExtensionSampleingIndex: number;
  let adtsChannelConfig: number;

  let esdsAtomData: ArrayBuffer;

  let userAgent: string = navigator.userAgent.toLowerCase();

  // byte 2
  adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
  adtsSamplingIndex = ((data[offset + 2] & 0x3C) >>> 2);
  if (adtsSamplingIndex > ADTS_SAMPLING_RATES_TABLE.length - 1) {
    console.error('Error in ADTS data');
    return null;
  }

  adtsChannelConfig = ((data[offset + 2] & 0x01) << 2);
  // byte 3
  adtsChannelConfig |= ((data[offset + 3] & 0xC0) >>> 6);

  // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
  if (/firefox/i.test(userAgent)) {
    if (adtsSamplingIndex >= 6) {
      adtsObjectType = 5;
      esdsAtomData = new ArrayBuffer(4);
      // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
      // there is a factor 2 between frame sample rate and output sample rate
      // multiply frequency by 2 (see table below, equivalent to substract 3)
      adtsExtensionSampleingIndex = adtsSamplingIndex - 3;
    } else {
      adtsObjectType = 2;
      esdsAtomData = new ArrayBuffer(2);
      adtsExtensionSampleingIndex = adtsSamplingIndex;
    }
  // Android : always use AAC
  } else if (userAgent.indexOf('android') !== -1) {
    adtsObjectType = 2;
    esdsAtomData = new ArrayBuffer(2);
    adtsExtensionSampleingIndex = adtsSamplingIndex;
  } else {
    /*  for other browsers (Chrome/Vivaldi/Opera ...)
        always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
    */
    adtsObjectType = 5;
    esdsAtomData = new ArrayBuffer(4);
    // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
    if ((audioCodecMimetype && ((audioCodecMimetype.indexOf('mp4a.40.29') !== -1) ||
      (audioCodecMimetype.indexOf('mp4a.40.5') !== -1))) ||
      (!audioCodecMimetype && adtsSamplingIndex >= 6)) {
      // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
      // there is a factor 2 between frame sample rate and output sample rate
      // multiply frequency by 2 (see table below, equivalent to substract 3)
      adtsExtensionSampleingIndex = adtsSamplingIndex - 3;
    } else {
      // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
      // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
      if (audioCodecMimetype && audioCodecMimetype.indexOf('mp4a.40.2') !== -1 && ((adtsSamplingIndex >= 6 && adtsChannelConfig === 1) ||
            /vivaldi/i.test(userAgent)) ||
        (!audioCodecMimetype && adtsChannelConfig === 1)) {
        adtsObjectType = 2;
        esdsAtomData = new ArrayBuffer(2);
      }
      adtsExtensionSampleingIndex = adtsSamplingIndex;
    }
  }

  /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config

    ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
    Audio Profile / Audio Object Type

    0: Null
    1: AAC Main
    2: AAC LC (Low Complexity)
    3: AAC SSR (Scalable Sample Rate)
    4: AAC LTP (Long Term Prediction)
    5: SBR (Spectral Band Replication)
    6: AAC Scalable sampling freq
    0: 96000 Hz
    1: 88200 Hz
    2: 64000 Hz
    3: 48000 Hz
    4: 44100 Hz
    5: 32000 Hz
    6: 24000 Hz
    7: 22050 Hz
    8: 16000 Hz
    9: 12000 Hz
    10: 11025 Hz
    11: 8000 Hz
    12: 7350 Hz
    13: Reserved
    14: Reserved
    15: frequency is written explictly

    Channel Configurations
    These are the channel configurations:
    0: Defined in AOT Specifc Config
    1: 1 channel: front-center
    2: 2 channels: front-left, front-right

  */

  // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
  esdsAtomData[0] = adtsObjectType << 3;
  // samplingFrequencyIndex
  esdsAtomData[0] |= (adtsSamplingIndex & 0x0E) >> 1;
  esdsAtomData[1] |= (adtsSamplingIndex & 0x01) << 7;
  // channelConfiguration
  esdsAtomData[1] |= adtsChannelConfig << 3;

  if (adtsObjectType === 5) {
    // adtsExtensionSampleingIndex
    esdsAtomData[1] |= (adtsExtensionSampleingIndex & 0x0E) >> 1;
    esdsAtomData[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
    // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
    //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
    esdsAtomData[2] |= 2 << 2;
    esdsAtomData[3] = 0;
  }

  return {
    esdsAtomData: esdsAtomData,
    sampleRate: ADTS_SAMPLING_RATES_TABLE[adtsSamplingIndex],
    channelCount: adtsChannelConfig,
    codec: ('mp4a.40.' + adtsObjectType)
  };
}

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
