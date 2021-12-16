
export const MPEG2TS_PACKET_SIZE: number = 188 as const;
export const MPEG2TS_SYNC_CHAR = 0x47 as const;
export const MPEG2TS_MAX_SCAN_WINDOW = 4096 as const;
export const MPEG_TS_TIMESCALE_HZ = 90000 as const;
export const MPEG_TS_MAX_TIMESTAMP = (Math.pow(2, 33) - 1);
export const MPEG_TS_MAX_TIMESTAMP_SECS = MPEG_TS_MAX_TIMESTAMP / MPEG_TS_TIMESCALE_HZ;
export const MP4_CMAF_MAX_TIME_SECS = MPEG_TS_MAX_TIMESTAMP_SECS / 2; // baseMediaDecodeTime uses 32 bits

export function findSyncOffsetInMpegTsChunk (
  data: Uint8Array,
  checkLastPacket: boolean = false,
  maxScanBytes: number = MPEG2TS_MAX_SCAN_WINDOW): number | null {

  // early return when less data than one packet
  if (data.byteLength < MPEG2TS_PACKET_SIZE) return null;
  for (let i = 0; i < data.byteLength; i++) {
    // early return when data remaining is less than one packet,
    // even if we found a sync-byte it would not allow to parse packets.
    if (data.byteLength - i < MPEG2TS_PACKET_SIZE) return null;
    // check current byte
    if (data[i] === MPEG2TS_SYNC_CHAR) {
      // we are fine so far if we dont want to check last packet sync byte
      if (!checkLastPacket) return i;

      // -> last-packet checking mode:

      // see how much data ahead can be parsed
      const packetBufferLen = data.byteLength - i;
      // if there is more than one packet
      // now check if the assumed last packet has a sync-byte,
      // assuming that everything in between is fine.
      // this is a lazy modus to validate the stream segmentation
      // without walking over every packet.
      if (packetBufferLen > MPEG2TS_PACKET_SIZE) {
        const packetDataResidue = (packetBufferLen % MPEG2TS_PACKET_SIZE);

        let lastSyncByteOffset;
        // if there is a residue (partial packet)
        // we check the sync-byte after the last assumed full packet last byte.
        if (packetDataResidue > 0) {
          lastSyncByteOffset = packetBufferLen - packetDataResidue;
        // or if we assume entire packets (residue = 0)
        // we rewinde 1 packet from buffer length to get last packet first byte.
        } else {
          packetBufferLen - MPEG2TS_PACKET_SIZE;
        }

        if (data[lastSyncByteOffset] === MPEG2TS_SYNC_CHAR) {
          return i;
        }
        // if this isn't satisfied it means there is garbage
        // after the packet we found. the sync-find loop will continue therefore.
      } else {
        // fast path for when there is no more than exactly one packet
        return i;
      }

    }
  }
  if (data.byteLength > maxScanBytes) {
    throw new Error('No MPTS sync-byte found in max-scan window ' + maxScanBytes);
  }
  return null;
}

export function wrapMpeg2TimeInMp4BaseDts(time: number): number {
  if (time > MP4_CMAF_MAX_TIME_SECS) {
    return time % MP4_CMAF_MAX_TIME_SECS;
  } else {
    return time;
  }
}
