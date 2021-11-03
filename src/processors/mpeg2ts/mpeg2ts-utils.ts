
export const MPEG2TS_PACKET_SIZE: number = 188 as const;
export const MPEG2TS_SYNC_CHAR = 0x47 as const;
export const MPEG2TS_MAX_SCAN_WINDOW = 4096 as const;
export const MPEG_TS_TIMESCALE_HZ = 90000 as const;
export const MPEG_TS_MAX_TIMESTAMP = (Math.pow(2, 33) - 1);
export const MPEG_TS_MAX_TIMESTAMP_SECS = MPEG_TS_MAX_TIMESTAMP / MPEG_TS_TIMESCALE_HZ;
export const MP4_CMAF_MAX_TIME_SECS = MPEG_TS_MAX_TIMESTAMP_SECS / 2; // baseMediaDecodeTime uses 32 bits

export function findSyncOffsetInMpegTsChunk (data: Uint8Array): number | null {
  // scan 4096 first bytes
  const scanWindow = Math.min(MPEG2TS_MAX_SCAN_WINDOW, data.length - 3 * MPEG2TS_PACKET_SIZE); // no scan happens if we have less than three packets
  let i = 0;
  while (i < scanWindow) {
    // a TS chunk should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
    if (data[i] === MPEG2TS_SYNC_CHAR &&
      data[i + MPEG2TS_PACKET_SIZE] === MPEG2TS_SYNC_CHAR &&
      data[i + 2 * MPEG2TS_PACKET_SIZE] === MPEG2TS_SYNC_CHAR) {
      return i;
    } else {
      i++;
    }
  }
  return null;
}
