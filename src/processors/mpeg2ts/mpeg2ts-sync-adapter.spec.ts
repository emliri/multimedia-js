/// <reference types="jest" />

import { describeSpecTopLevel } from '../../utils-spec';
import { readFile } from '../../utils-fs';

import { Mpeg2TsSyncAdapter } from './mpeg2ts-sync-adapter';
import { MPEG2TS_PACKET_SIZE } from './mpeg2ts-utils';

global.window = null;

const TEST_FILES_VECTOR = [
  // 'data/CLK2.ts'
];

describeSpecTopLevel(__filename, () => {
  if (TEST_FILES_VECTOR.length === 0) {
    it('should dummmy', () => void 0);
    return;
  }

  let testBuffers: Uint8Array[] = null;

  beforeAll((done) => {
    Promise.all(TEST_FILES_VECTOR.map((file) => readFile(file)))
      .then((buffers) => {
        testBuffers = buffers;
        done();
      });
  });

  let mp2tSyncAdapter: Mpeg2TsSyncAdapter = null;
  beforeEach(() => {
    mp2tSyncAdapter = new Mpeg2TsSyncAdapter();
  });

  afterEach(() => {
    mp2tSyncAdapter.clear();
    mp2tSyncAdapter = null;
  });

  it('should find sync and count nb of packet bytes on a plain simple dump', () => {
    mp2tSyncAdapter.feed(testBuffers[0]);

    expect(mp2tSyncAdapter.getSyncOffset()).toBe(0);
    expect(mp2tSyncAdapter.getEstimatedPacketBytesSize()).toBe(1200192);
    expect(mp2tSyncAdapter.isLastPacketTruncated()).toBe(false);
    expect(mp2tSyncAdapter.getEstimatedPacketsCount()).toBe(1200192 / MPEG2TS_PACKET_SIZE);
    expect(mp2tSyncAdapter.getTotalBufferSize()).toBe(1200192);
    expect(mp2tSyncAdapter.getPacketBufferSize()).toBe(1200192);
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(0);
  });

  it('should skip any garbage upfront (partial packet) and find sync, and compute correct bytes/offset values', () => {
    const initialOffset = 14;

    mp2tSyncAdapter.feed(new Uint8Array(testBuffers[0].buffer, initialOffset));

    expect(mp2tSyncAdapter.getSyncOffset()).toBe(MPEG2TS_PACKET_SIZE - initialOffset);
    expect(mp2tSyncAdapter.getEstimatedPacketBytesSize()).toBe(1200178 - mp2tSyncAdapter.getSyncOffset());
    expect(mp2tSyncAdapter.isLastPacketTruncated()).toBe(false);
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(0);
    expect(mp2tSyncAdapter.getEstimatedPacketsCount()).toBe(mp2tSyncAdapter.getEstimatedPacketBytesSize() / 188);
    expect(mp2tSyncAdapter.getTotalBufferSize()).toBe(1200178);
    expect(mp2tSyncAdapter.getPacketBufferSize()).toBe(mp2tSyncAdapter.getEstimatedPacketBytesSize());
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(0);
  });

  it('should - with truncated packet end - skip any garbage upfront (partial packet) and find sync, and compute correct bytes/offset values', () => {
    const initialOffset = 14;
    const cutSize = 1200192 - initialOffset - 1200105;

    mp2tSyncAdapter.feed(new Uint8Array(testBuffers[0].buffer, initialOffset, 1200105));

    expect(mp2tSyncAdapter.getSyncOffset()).toBe(MPEG2TS_PACKET_SIZE - initialOffset);
    expect(mp2tSyncAdapter.getEstimatedPacketBytesSize()).toBe(MPEG2TS_PACKET_SIZE * ((1200192 / MPEG2TS_PACKET_SIZE) - 2)); // TWO packets (one front one back are partial now)
    expect(mp2tSyncAdapter.isLastPacketTruncated()).toBe(true);
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(mp2tSyncAdapter.getPacketBufferSize() - mp2tSyncAdapter.getEstimatedPacketBytesSize());
    expect(mp2tSyncAdapter.getEstimatedPacketsCount()).toBe(mp2tSyncAdapter.getEstimatedPacketBytesSize() / 188);
    expect(mp2tSyncAdapter.getTotalBufferSize()).toBe(1200105);
    expect(mp2tSyncAdapter.getPacketBufferSize()).toBe(1200105 - mp2tSyncAdapter.getSyncOffset());
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(MPEG2TS_PACKET_SIZE - cutSize);
  });

  it('should allow to take() the desired nb of packets from the buffer', () => {
    const initialOffset = MPEG2TS_PACKET_SIZE + 56;
    const buf = new Uint8Array(testBuffers[0].buffer, initialOffset, 1200192 - initialOffset - 24);
    const initialBufTotalSize = buf.byteLength;

    const syncOffsetShould = (MPEG2TS_PACKET_SIZE - 56); // initialOffset % MPEG2TS_PACKET_SIZE ?
    const nbPacketsShould = ((1200192 / MPEG2TS_PACKET_SIZE) - 3);
    const remainderBytesShould = (initialBufTotalSize - syncOffsetShould) - (MPEG2TS_PACKET_SIZE * nbPacketsShould);

    mp2tSyncAdapter.feed(buf);

    expect(mp2tSyncAdapter.getEstimatedPacketsCount()).toBe(nbPacketsShould);
    expect(mp2tSyncAdapter.isLastPacketTruncated()).toBe(true);
    expect(mp2tSyncAdapter.getTotalBufferSize()).toBe(initialBufTotalSize);
    expect(mp2tSyncAdapter.getSyncOffset()).toBe(syncOffsetShould);
    expect(mp2tSyncAdapter.getPacketBufferSize()).toBe(initialBufTotalSize - syncOffsetShould);
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(remainderBytesShould);

    let out = mp2tSyncAdapter.take(0, 3000);

    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(remainderBytesShould);
    expect(mp2tSyncAdapter.getEstimatedPacketsCount()).toBe(nbPacketsShould - 3000);

    expect(mp2tSyncAdapter.getTotalBufferSize()).toBe(initialBufTotalSize - (3000 * MPEG2TS_PACKET_SIZE) - syncOffsetShould);

    expect(out.byteLength).toBe(3000 * MPEG2TS_PACKET_SIZE);

    expect(mp2tSyncAdapter.getSyncOffset()).toBe(0);
    expect(mp2tSyncAdapter.isLastPacketTruncated()).toBe(true);

    out = mp2tSyncAdapter.take(mp2tSyncAdapter.getEstimatedPacketsCount());

    expect(out.byteLength).toBe((nbPacketsShould - 3000) * MPEG2TS_PACKET_SIZE);
    expect(mp2tSyncAdapter.getTotalBufferSize()).toBe(remainderBytesShould);
    expect(mp2tSyncAdapter.getPacketBufferSize()).toBe(remainderBytesShould);
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(remainderBytesShould);
    expect(mp2tSyncAdapter.getEstimatedPacketsCount()).toBe(0);
    expect(mp2tSyncAdapter.isLastPacketTruncated()).toBe(true);
  });

  it('should allow to feed() subsequently and grow the buffer accordingly', () => {
    const initialOffset = MPEG2TS_PACKET_SIZE + 56;
    const syncOffsetShould = (MPEG2TS_PACKET_SIZE - 56);

    const buf1 = new Uint8Array(testBuffers[0].buffer, initialOffset, 1200192 - initialOffset - 24);
    const buf2 = new Uint8Array(testBuffers[0].buffer, 1200192 - 24, 24);

    mp2tSyncAdapter.feed(buf1);
    mp2tSyncAdapter.feed(buf2);

    expect(mp2tSyncAdapter.getSyncOffset()).toBe(syncOffsetShould);
    expect(mp2tSyncAdapter.getTotalBufferSize()).toBe(1200192 - initialOffset);
    expect(mp2tSyncAdapter.getPacketBufferSize()).toBe(mp2tSyncAdapter.getTotalBufferSize() - syncOffsetShould);
    expect(mp2tSyncAdapter.getPacketBufferRemainderBytes()).toBe(0);
  });

  it('should return a Uint8Array of min-requested packets on take()', () => {

  });

  it('should return null on take() when no packets are available', () => {

  });

  it('should return null on take() when not enough packets are available', () => {

  });
});
