import { BufferSlice, InputSocket, Packet, Socket, OutputSocket, SocketDescriptor, SocketTemplateGenerator, SocketType, CommonMimeTypes } from '../..';
import { arrayLast, orZero } from '../common-utils';

import { Mpeg2TsSyncAdapter } from './mpeg2ts/mpeg2ts-sync-adapter';
import { MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';

import { inspectMpegTsPackets, InspectMpegTsPacketsResult, InspectMpegTsPmtInfo } from './muxjs-m2t/muxjs-m2t';

import { SocketTapTimingRegulate } from '../socket-taps';
import { mixinProcessorWithOptions } from '../core/processor';

import { getLogger, LoggerLevel } from '../logger';

const { warn } = getLogger('Mp2TsAnalyzerProc', LoggerLevel.ON);

const DEFAULT_PLAYOUT_REGULATION_POLL_MS = 200; // rougly the usual period
                                                // of PCR packets

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MPEGTS), // valid input
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MPEGTS) // expected output
  );

function getPacketDts (info: InspectMpegTsPacketsResult): number {
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

const Mp2TsAnalyzerProc_ = mixinProcessorWithOptions<Mp2TsAnalyzerProcOpts>({
  enablePlayoutRegulation: false,
  playoutRegulationSpeed: 1,
  playoutRegulationPollMs: DEFAULT_PLAYOUT_REGULATION_POLL_MS
});

export type Mp2TsAnalyzerProcOpts = {
  enablePlayoutRegulation: boolean
  playoutRegulationSpeed: number
  playoutRegulationPollMs: number
};

export class Mp2TsAnalyzerProc extends Mp2TsAnalyzerProc_ {
  private _opts: Mp2TsAnalyzerProcOpts;

  private _mptsSyncAdapter: Mpeg2TsSyncAdapter = new Mpeg2TsSyncAdapter();
  private _analyzePsiPesBuffer: BufferSlice = null;
  private _analyzePmtCache: InspectMpegTsPmtInfo = null;
  private _timingRegulatorSock: OutputSocket;

  constructor (opts?: Partial<Mp2TsAnalyzerProcOpts>) {
    super();

    this.setOptions(opts);

    this.createInput();
    this.createOutput();

    this._timingRegulatorSock
      = OutputSocket.fromUnsafe(
        new OutputSocket(this.templateSocketDescriptor(SocketType.OUTPUT))
        .setTap(new SocketTapTimingRegulate({
          timingRegulationOn: opts.enablePlayoutRegulation,
          timingRegulationSpeed: opts.playoutRegulationSpeed,
          timingRegulationPollMs: opts.playoutRegulationPollMs
        })))
        .connect(this.out[0]);
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

      const dts = getPacketDts(tsInspectRes);

      const pkt = Packet.fromSlice(this._analyzePsiPesBuffer)
                    .setTimingInfo(dts, 0, MPEG_TS_TIMESCALE_HZ);

      this._timingRegulatorSock.transfer(pkt);

      this._analyzePsiPesBuffer = null;

    }

    return true;
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
