import { BufferSlice, InputSocket, Packet, Processor, SocketDescriptor, SocketTemplateGenerator, SocketType } from '../..';
import { arrayLast, millisToSecs, orInfinity, orZero, secsToMillis, timeMillisSince } from '../common-utils';
import { CommonCodecFourCCs, CommonMimeTypes } from '../core/payload-description';

import { Mpeg2TsSyncAdapter } from './mpeg2ts/mpeg2ts-sync-adapter';
import { MPEG2TS_PACKET_SIZE, MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';

import { inspectMpegTsPackets, InspectMpegTsPacketsResult, InspectMpegTsPmtInfo } from './muxjs-m2t/muxjs-m2t';

import { getLogger, LoggerLevel } from '../logger';

const { warn } = getLogger('Mp2TsAnalyzerProc', LoggerLevel.ON);

const DEFAULT_PLAYOUT_REGULATION_POLL_MS = 900;

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MPEGTS), // valid input
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MPEGTS) // expected output
  );

type AnalysisResultItem = [InspectMpegTsPacketsResult, BufferSlice];

export type Mp2TsAnalyzerProcOpts = {
  enablePlayoutRegulation: boolean
  playoutRegulationSpeed: number
  playoutRegulationPollMs: number
};

export class Mp2TsAnalyzerProc extends Processor {
  private _opts: Mp2TsAnalyzerProcOpts;

  private _mptsSyncAdapter: Mpeg2TsSyncAdapter = new Mpeg2TsSyncAdapter();
  private _analyzePsiPesBuffer: BufferSlice = null;
  private _analyzePmtCache: InspectMpegTsPmtInfo = null;

  private _transferOutQueue: AnalysisResultItem[] = [];
  private _transferOutDts: number = NaN;
  private _playOutTime: number = NaN;

  static get DefaultOpts(): Mp2TsAnalyzerProcOpts {
    return {
      enablePlayoutRegulation: false,
      playoutRegulationSpeed: 1,
      playoutRegulationPollMs: DEFAULT_PLAYOUT_REGULATION_POLL_MS
    }
  }

  constructor (opts: Partial<Mp2TsAnalyzerProcOpts> = Mp2TsAnalyzerProc.DefaultOpts) {
    super();

    this.createInput();
    this.createOutput();

    this._opts = Object.assign({}, Mp2TsAnalyzerProc.DefaultOpts, opts);
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_ (inS: InputSocket, p: Packet, inputIndex: number): boolean {
    this._mptsSyncAdapter.feed(p.data[0].getUint8Array());

    while (true) {
      const nextPktBuf: Uint8Array = this._mptsSyncAdapter.take(1, 1);
      if (!nextPktBuf) break;
      if (!this._analyzePsiPesBuffer) {
        this._analyzePsiPesBuffer = BufferSlice.fromTypedArray(nextPktBuf);
      } else {
        this._analyzePsiPesBuffer = this._analyzePsiPesBuffer.append(BufferSlice.fromTypedArray(nextPktBuf));
      }

      const tsInspectRes: InspectMpegTsPacketsResult =
        inspectMpegTsPackets(
          this._analyzePsiPesBuffer.getUint8Array(),
          NaN,
          false,
          this._analyzePmtCache);

      // no result so far, go to take 1 more packet from adapter
      if (!tsInspectRes) continue;

      this._transferOutQueue.push([tsInspectRes, this._analyzePsiPesBuffer]);
      this._analyzePsiPesBuffer = null;

      this._onPollTransferOutQueue();

    }

    return true;
  }

  private _onPollTransferOutQueue() {
    // optimized early return as we may poll periodically on empty queue
    // and avoids further checks in logic below
    if (!this._transferOutQueue.length) return;
    if (!this._opts.enablePlayoutRegulation) {
      // transfer/flush whole queue
      this._transferOutQueue.forEach(this._transferOutQueueItem.bind(this));
      this._transferOutQueue.length = 0;
      this._playOutTime = Date.now();
    } else {
      const [playOutToWallClockDiff, now] = timeMillisSince(this._playOutTime);
      // initial condition setup
      if (!Number.isFinite(this._transferOutDts) || !Number.isFinite(this._playOutTime)) {
        this._transferOutQueueItem(this._transferOutQueue.shift());
        this._playOutTime = now;
      }

      const playSeconds = millisToSecs(playOutToWallClockDiff);
      const playRate = this._opts.playoutRegulationSpeed;
      const playOutTicks = playRate * playSeconds * MPEG_TS_TIMESCALE_HZ;

      // pre: this._transferOutDts is positive integer
      const refDts = this._transferOutDts;
      const maxTransferOutDts = refDts + playOutTicks;

      let dtsCycled = false;
      while (this._transferOutQueue.length
        && this._getQueueItemDts(this._transferOutQueue[0][0]) <= maxTransferOutDts) {
          // post: DTS counter change
          this._transferOutQueueItem(this._transferOutQueue.shift());
          if (this._transferOutDts < refDts) {
            warn('Regulation-delay hit DTS rollover/discontinuity, resetting');
            dtsCycled = true;
            break;
          }
      }
      if (!dtsCycled) {
        this._playOutTime += secsToMillis(((this._transferOutDts - refDts) / playRate) / MPEG_TS_TIMESCALE_HZ);
      } else {
        this._playOutTime = now;
      }

    }
    // reschedule if polling
    if (this._opts.playoutRegulationPollMs > 0) {
      setTimeout(() => {
        this._onPollTransferOutQueue();
      }, this._opts.playoutRegulationPollMs);
    }
  }

  private _getQueueItemDts(info: InspectMpegTsPacketsResult): number {
    let videoDts: number;
    let audioDts: number;
    if (info.audio?.length) {
      audioDts = arrayLast(info.audio).dts;
    }
    if (info.video?.length) {
      videoDts = arrayLast(info.video).dts;
    }

    if (!Number.isFinite(audioDts) && !Number.isFinite(videoDts)) {
      throw new Error('Post-Analyzer last queue item has no A/V-samples timing info');
    }

    const nextLastDts = Math.max(
      orZero(audioDts),
      orZero(videoDts));
    return nextLastDts;
  }

  private _transferOutQueueItem([info, data]: AnalysisResultItem) {
    const nextLastDts = this._transferOutDts = this._getQueueItemDts(info);

    const outPkt = Packet.fromSlice(data);
    outPkt.setTimingInfo(nextLastDts, 0, MPEG_TS_TIMESCALE_HZ);

    this.out[0].transfer(outPkt);

    console.log(new Date().toISOString(), nextLastDts / MPEG_TS_TIMESCALE_HZ);
  }
}

      // TODO: put this stuff in another function and/or process after queue
      /*
      const pmtInfoRes = tsInspectRes.pmt || this._analyzePmtCache;
      if (!pmtInfoRes) break;
      else {
        this._analyzePmtCache = pmtInfoRes;
      }

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
      //
      // the condition as-is ensures that there are more than 1 frame
      // of any kind in the PES analysis buffer.
      if ((orZero(tsInspectRes.video?.length) >= 1
          && orZero(tsInspectRes.audio?.length)) >= 1) {
        // remove the last packet from the pes-buffer
        // as it contains the next frame
        // so that each packet we push only contains the first frame found
        const nextBuf = this._analyzePsiPesBuffer
          .shrinkFront(this._analyzePsiPesBuffer.length - MPEG2TS_PACKET_SIZE);
        this._analyzePsiPesBuffer =
          this._analyzePsiPesBuffer.shrinkBack(MPEG2TS_PACKET_SIZE);

        let firstVideoTimestamp = NaN;
        let firstAudioTimestamp = NaN;
        let firstVideoFrameIsIframe = false;

        if (tsInspectRes.video?.length) {
          firstVideoTimestamp = tsInspectRes.video[0].dts;
          if (tsInspectRes.firstKeyFrame) {
            //console.log(tsInspectRes);
            if (tsInspectRes.firstKeyFrame.dts === firstVideoTimestamp) {
              firstVideoFrameIsIframe = true;
            }
          }
        }
        if (tsInspectRes.audio?.length) {
          firstAudioTimestamp = tsInspectRes.audio[0].dts;
        }

        const firstTimestamp = Math.min(
          orInfinity(firstAudioTimestamp),
          orInfinity(firstVideoTimestamp));

        const isVideoOrAudio = firstTimestamp === firstVideoTimestamp;

        this._analyzePsiPesBuffer.props.mimeType =
          isVideoOrAudio ? 'video/mp2t' : 'audio/mp2t';
        this._analyzePsiPesBuffer.props.codec =
          isVideoOrAudio ? CommonCodecFourCCs.avc1 : CommonCodecFourCCs.mp4a;

        const outPkt = Packet.fromSlice(this._analyzePsiPesBuffer);
        outPkt.setTimingInfo(firstTimestamp, 0, MPEG_TS_TIMESCALE_HZ);
        outPkt.defaultPayloadInfo.isKeyframe = firstVideoFrameIsIframe;

        this.out[0].transfer(outPkt);

        this._analyzePsiPesBuffer = nextBuf;
      }
      */
