import { BufferSlice, InputSocket, Packet, Processor } from '../..';
import { orInfinity, orMax } from '../common-utils';
import { Mpeg2TsSyncAdapter } from './mpeg2ts/mpeg2ts-sync-adapter';
import { MPEG2TS_PACKET_SIZE, MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';
import { inspectMpegTsPackets, InspectMpegTsPacketsResult } from './muxjs-m2t/muxjs-m2t';

export class Mp2TsAnalyzerProc extends Processor {
  private _mptsSyncAdapter: Mpeg2TsSyncAdapter = new Mpeg2TsSyncAdapter();
  private _analyzePsiPesBuffer: BufferSlice = null;

  constructor () {
    super();
    this.createInput();
    this.createOutput();
  }

  protected processTransfer_ (inS: InputSocket, p: Packet, inputIndex: number): boolean {
    this._mptsSyncAdapter.feed(p.data[0].getUint8Array());

    let runLoop = true;
    while (runLoop) {
      const nextPktBuf: Uint8Array = this._mptsSyncAdapter.take(1, 1);
      if (!nextPktBuf) break;
      if (!this._analyzePsiPesBuffer) {
        this._analyzePsiPesBuffer = BufferSlice.fromTypedArray(nextPktBuf);
      } else {
        this._analyzePsiPesBuffer = this._analyzePsiPesBuffer.append(BufferSlice.fromTypedArray(nextPktBuf));
      }

      const tsInspectRes: InspectMpegTsPacketsResult =
        inspectMpegTsPackets(this._analyzePsiPesBuffer.getUint8Array());

      // we need to inspect PES analyze-buffer *until*
      // any second frame found to make sure what we push will
      // contain any full frame data.
      // It is OK to have 1 audio *and* 1 video frame
      // so far, as soon as any 2nd frame of any kind
      // appears, we are sure that we have complete frames
      // i.e new PUSIs in PES of either kind.
      //
      // since we are only taking exactly 1 packet ever
      // from the adapter, and any packet only contains
      // one type of PES, it is ensured this progressive inspecting
      // is "atomic" in the sense that the number of frames
      // can only possibly increase by 0 or 1 on each iteration.
      if (tsInspectRes?.video.length > 1 ||
        tsInspectRes?.audio.length > 1) {
        runLoop = false;

        // remove the last packet from the pes-buffer
        // as it contains the next frame
        // so that each packet we push only contains the first frame found
        this._analyzePsiPesBuffer =
          this._analyzePsiPesBuffer.shrinkBack(MPEG2TS_PACKET_SIZE);

        let firstVideoTimestamp = NaN;
        let firstAudioTimestamp = NaN;

        if (tsInspectRes?.video.length) {
          firstVideoTimestamp = tsInspectRes?.video[0].dts;
        }
        if (tsInspectRes?.audio.length) {
          firstAudioTimestamp = tsInspectRes?.video[0].dts;
        }

        const minTimestamp = Math.min(
          orInfinity(firstAudioTimestamp),
          orInfinity(firstVideoTimestamp));

        const outPkt = Packet.fromSlice(this._analyzePsiPesBuffer);
        outPkt.setTimingInfo(minTimestamp, 0, MPEG_TS_TIMESCALE_HZ);
        this.out[0].transfer(outPkt);
        this._analyzePsiPesBuffer = BufferSlice.fromTypedArray(nextPktBuf);
      }
    }

    return true;
  }
}
