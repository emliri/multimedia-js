
import { Nullable } from '../../common-types';
import { findSyncOffsetInMpegTsChunk, MPEG2TS_PACKET_SIZE } from './mpeg2ts-utils';

export class Mpeg2TsSyncAdapter {
  private _buffer: Uint8Array = null;
  private _syncOffset: number = null;

  constructor (private _maxBufferSize: number = Infinity) {}

  feed (buffer: Uint8Array) {
    if (!this._buffer) {
      if (buffer.byteLength > this._maxBufferSize) throw new Error('Initial bytes feed exceeds limit');
      this._buffer = buffer;
    } else {
      const existingBuf = this._buffer;

      const newSize = existingBuf.byteLength + buffer.byteLength;
      if (newSize > this._maxBufferSize) throw new Error('New bytes allocation exceeds limit');

      const newBufferView = new Uint8Array(newSize);
      newBufferView.set(existingBuf, 0);
      newBufferView.set(buffer, existingBuf.byteLength);
      this._buffer = newBufferView;
    }

    if (this._syncOffset === null) {
      this._syncOffset = findSyncOffsetInMpegTsChunk(this._buffer);
    }

  }

  /**
   * Read until last possibly truncated packet (not including).
   * @param minNumPackets Defaults to 1, will return null if value not at least available.
   * @param maxNumPackets Defaults to Infinity, may read less packets (as much as available)
   * @returns Complete packets buffer
   */
  take (maxNumPackets: number = Infinity, minNumPackets: number = 1): Nullable<Uint8Array> {
    if (minNumPackets > maxNumPackets) {
      throw new Error('minNumPackets larger than maxNumPackets');
    }
    if (minNumPackets < 1) throw new Error('minNumPackets must be greater-equal 1');

    const packetCnt = this.getPacketsCount();
    // packets we got not enough (note minNumPackets always >= 1)
    // so this also handles packetCnt = 0
    if (packetCnt < minNumPackets) return null;

    // limit packets taken by max param
    const packetsNeeded = Math.min(maxNumPackets, packetCnt);
    const packetBytes = packetsNeeded * MPEG2TS_PACKET_SIZE;

    const offsetStart = this._syncOffset;
    const offsetEnd = offsetStart + packetBytes;

    const buffer = new Uint8Array(
      this._buffer.buffer,
      this._buffer.byteOffset + offsetStart,
      packetBytes);

    const remainingBufSize = this._buffer.byteLength - packetBytes - offsetStart;

    // if there is more data left in buffer,
    // then shift it, set offset to zero
    if (remainingBufSize > 0) {
      this._buffer = new Uint8Array(this._buffer.buffer, this._buffer.byteOffset + offsetEnd, remainingBufSize);
      // re-sync at this point. we assumed for the currently taken data
      // that it was fully packet-aligned although we only checked
      // the first packet had a sync byte, instead of walking over
      // the whole buffer. also, we don't check again once a first sync-byte
      // was found on more data feed in.
      // we check again on the remainder data here after data has been taken.
      this._syncOffset = findSyncOffsetInMpegTsChunk(this._buffer);
    } else { // otherwise free up and reset to init state
      this.clear();
    }

    return buffer;
  }

  clear () {
    this._buffer = null;
    this._syncOffset = null;
  }

  getSyncOffset (): number {
    return this._syncOffset;
  }

  getTotalBufferSize (): number {
    return this._buffer ? this._buffer.byteLength : 0;
  }

  getPacketBufferSize (): number {
    if (this._syncOffset === null) return 0;
    return this._buffer.byteLength - this._syncOffset;
  }

  isLastPacketTruncated (): boolean {
    // return (this.getEstimatedPacketBytesSize() - this.getPacketBufferSize()) !== 0;
    return this.getPacketBufferSize() % MPEG2TS_PACKET_SIZE !== 0;
  }

  getPacketBufferRemainderBytes (): number {
    return (this.getPacketBufferSize() - this.getPacketsBytesSize());
  }

  getPacketsCount (): number {
    if (this._syncOffset === null) return 0;
    const pktBufSize = this.getPacketBufferSize();
    return Math.floor(pktBufSize / MPEG2TS_PACKET_SIZE);
  }

  getPacketsBytesSize (): number {
    if (this._syncOffset === null) return 0;
    return MPEG2TS_PACKET_SIZE * this.getPacketsCount();
  }
}
