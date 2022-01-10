
export const MPEG2TS_PACKET_SIZE: number = 188 as const;
export const MPEG2TS_SYNC_CHAR = 0x47 as const;
export const MPEG2TS_MAX_SCAN_WINDOW = 4096 as const;
export const MPEG_TS_TIMESCALE_HZ = 90000 as const;
export const MPEG_TS_MAX_TIMESTAMP = (Math.pow(2, 33) - 1);
export const MPEG_TS_MAX_TIMESTAMP_SECS = MPEG_TS_MAX_TIMESTAMP / MPEG_TS_TIMESCALE_HZ;
export const MPEG_TS_TIMESCALE_FMP4_MAX_SECS = (Math.pow(2, 32) - 1) / MPEG_TS_TIMESCALE_HZ; // baseMediaDecodeTime uses 32 bits

export function findSyncOffsetInMpegTsChunk (
  data: Uint8Array,
  checkLastPacket: boolean = false,
  maxScanBytes: number = MPEG2TS_MAX_SCAN_WINDOW): number | null {
  // early return when less data than one packet
  if (data.byteLength < MPEG2TS_PACKET_SIZE) return null;

  for (let i = 0; i < data.byteLength; i++) {
    // see how much data ahead can be parsed
    const packetBufferLen = data.byteLength - i;

    // early return when data remaining is less than one packet,
    // even if we found a sync-byte it would not allow to parse packets.
    if (packetBufferLen < MPEG2TS_PACKET_SIZE) return null;

    // check current byte
    if (data[i] === MPEG2TS_SYNC_CHAR) {
      // we are fine so far if we dont want to check last packet sync byte
      if (!checkLastPacket) return i;

      // no last packet ->
      // fast path for when there is no more than one packet:
      // note that preconditions may not allow less than 1 packet
      // (while we are flexible with this assumption),
      // it may be exactly 1.
      if (packetBufferLen <= MPEG2TS_PACKET_SIZE) {
        return i;
      }

      // -> last-packet checking mode:

      // this is a lazy modus to validate the stream segmentation
      // without walking over every packet:
      // as there is more bytes than one packet
      // check if the assumed last (even partial) packet has a sync-byte.
      // thus implicitly assuming that everything in between is fine.

      // assumes there is more bytes than 1 packet,
      // i.e some last packet (even partial) exists,
      // we want to find the first/sync byte of that last packet.
      let lastSyncByteOffset = i; // make sure to offset from current first packet
      // we will have to case-diff on the last packet being partial,
      // or having a buffer filled with entire packets.
      const packetDataResidue = (packetBufferLen % MPEG2TS_PACKET_SIZE);
      // if there is a residue (partial packet)
      // we check the sync-byte after the last assumed full packet last byte.
      if (packetDataResidue > 0) {
        lastSyncByteOffset += packetBufferLen - packetDataResidue;
      // else we should assume entire packets (residue = 0)
      // we rewind 1 packet from buffer length to get last packet first byte.
      } else {
        lastSyncByteOffset += packetBufferLen - MPEG2TS_PACKET_SIZE;
      }

      if (data[lastSyncByteOffset] === MPEG2TS_SYNC_CHAR) {
        return i;
      }

      // when above if isn't satisfied it means there is garbage
      // after the packet we found. the sync-find loop will continue therefore.
    }
  }
  if (data.byteLength > maxScanBytes) {
    throw new Error('No MPTS sync-byte found in max-scan window ' + maxScanBytes);
  }
  return null;
}

export function wrapMpeg2TimeInMp4BaseDts (time: number): number {
  if (time >= MPEG_TS_TIMESCALE_FMP4_MAX_SECS) {
    return time % MPEG_TS_TIMESCALE_FMP4_MAX_SECS;
  } else {
    return time;
  }
}

export function mpeg2TsClockToSecs (time90khz: number) {
  return time90khz / MPEG_TS_TIMESCALE_HZ;
}
