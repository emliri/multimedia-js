import {
  BufferSlice,
  InputSocket,
  Packet,
  OutputSocket,
  SocketDescriptor,
  SocketTemplateGenerator,
  SocketType,
  CommonMimeTypes
} from '../..';

import { orInfinity } from '../common-utils';
import { getLogger, LoggerLevel } from '../logger';

import { mixinProcessorWithOptions } from '../core/processor';
import { CommonCodecFourCCs } from '../core/payload-description';

import { SocketTapTimingRegulate } from '../socket-taps';

import { Mpeg2TsSyncAdapter } from './mpeg2ts/mpeg2ts-sync-adapter';

import { Frame, Track } from '../ext-mod/inspector.js/src';
import { MpegTSDemuxer } from '../ext-mod/inspector.js/src/demuxer/ts/mpegts-demuxer';
import { MICROSECOND_TIMESCALE } from '../ext-mod/inspector.js/src/utils/timescale';
import { H264Reader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/h264-reader';
import { FRAME_TYPE } from '../ext-mod/inspector.js/src/codecs/h264/nal-units';

const { warn } = getLogger('Mp2TsAnalyzerProc', LoggerLevel.OFF);

const DEFAULT_PLAYOUT_REGULATION_POLL_MS = 200; // rougly the usual period
// of PCR packets

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MPEGTS), // valid input
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MPEGTS) // expected output
  );

const Mp2TsAnalyzerProcOptsMixin = mixinProcessorWithOptions<Mp2TsAnalyzerProcOpts>({
  enablePlayoutRegulation: false,
  playoutRegulationSpeed: 1,
  playoutRegulationPollMs: DEFAULT_PLAYOUT_REGULATION_POLL_MS
});

export type Mp2TsAnalyzerProcOpts = {
  enablePlayoutRegulation: boolean
  playoutRegulationSpeed: number
  playoutRegulationPollMs: number
};

export class Mp2TsAnalyzerProc extends Mp2TsAnalyzerProcOptsMixin {
  static getName (): string {
    return 'Mp2TsAnalyzerProc';
  }

  private _mptsSyncAdapter: Mpeg2TsSyncAdapter = new Mpeg2TsSyncAdapter();
  private _timingRegulatorSock: OutputSocket;
  private _tsParser: MpegTSDemuxer = new MpegTSDemuxer();

  constructor (opts?: Partial<Mp2TsAnalyzerProcOpts>) {
    super();

    opts = this.setOptions(opts);
    this.createInput();
    this.createOutput();

    // configure the PTS based output regulation internal socket
    // and connect to proc out
    this._timingRegulatorSock =
      OutputSocket.fromUnsafe(
        new OutputSocket(this.templateSocketDescriptor(SocketType.OUTPUT))
          .setTap(new SocketTapTimingRegulate({
            timingRegulationOn: opts.enablePlayoutRegulation,
            timingRegulationSpeed: opts.playoutRegulationSpeed,
            timingRegulationPollMs: opts.playoutRegulationPollMs
          })))
        .connect(this.out[0]);

    this._tsParser.onPmtParsed = () => {
      // console.log('got PMT')
    };
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_ (inS: InputSocket, p: Packet, inputIndex: number): boolean {
    const bufIn = p.data[0].getUint8Array();

    this._mptsSyncAdapter.feed(bufIn);

    while (true) {
      // appending 1 packet at a time is required
      // for the below segmentation logic
      const nextPktBuf: Uint8Array = this._mptsSyncAdapter.take(1);
      if (!nextPktBuf) {
        break;
      }

      this._parsePackets(nextPktBuf);
    }

    return true;
  }

  private _parsePackets (mptsPktData: Uint8Array) {
    let aFrames: Frame[];
    let vFrames: Frame[];

    let gotVideoKeyframe = false;
    let gotAvcInitData = false;

    let spsPpsTimeUs: number;

    this._tsParser.append(mptsPktData);

    Object.values(this._tsParser.tracks).forEach((track) => {
      // pops all frames of prior complete payload-units (until next PUSI)
      const frames = track.popFrames();
      // the fact that we pop all the tracks frames at this point
      // is related to the PES-type segmentation to which we default here below.
      // if we would want to run time-range segmentation across all PES
      // (for example for HLS output) we would need to collect the frames
      // in the analyzer instance state or not pop them here but based on
      // the segmentation criteria other than "1 frame of either PES".
      // then again, the PES-AU atomic segmentation done here can be
      // used as a canonical output to produce any other segmentation in principle.
      switch (track.type) {
      case Track.TYPE_VIDEO:
        vFrames = frames;

        gotVideoKeyframe = frames.some(frame => frame.frameType === FRAME_TYPE.I);
        // sps/pps can come in 1 PUSI with prior p-frame !
        const h264Reader = (<H264Reader> track.pes.payloadReader);
        if (h264Reader.sps && h264Reader.pps) {
          spsPpsTimeUs = h264Reader.timeUs;
          // reset the reader state
          h264Reader.sps = null;
          h264Reader.pps = false;
          gotAvcInitData = true;
        }

        break;
      case Track.TYPE_AUDIO:
        aFrames = frames;
        break;
      }
    });

    // pre-condition for code inside this if-block
    // is that at least one of the tracks has >= 1 frames.
    // either frames list can be undefined if there is no respective a/v track.
    if (aFrames?.length || vFrames?.length || gotAvcInitData) {
      const firstPtsA = orInfinity(aFrames?.length && aFrames[0].timeUs);
      const firstPtsV = orInfinity(vFrames?.length && vFrames[0].timeUs);
      let firstPtsUs = Math.min(
        firstPtsA,
        firstPtsV,
        orInfinity(spsPpsTimeUs) // will only be defined if there were no video frames to get timing from.
      );

      // this is needed to handle timeUs = 0.
      // based on the preconditions here
      // firstPtsUs = Infinity can only result
      // when one or more of the tracks first frame PTS = 0.
      if (firstPtsUs === Infinity) firstPtsUs = 0;

      // we have this check here to assert in a specific mode
      // of segmentation which is default now (see above on popFrames).
      // but the above logic to gather first PTS
      // of either composed lists of A/V frames is more generic
      // and might thus be used for other future segmentation modes
      // for example solely time-range based but not across PES / codecs.
      // ATM we expect what the below assertions express only.
      let codec4cc: string;
      if (aFrames?.length && vFrames?.length) {
        throw new Error('Expected to have only one type of frames in this PES segmentation mode');
      } else if (aFrames?.length) {
        codec4cc = CommonCodecFourCCs.mp4a;
      } else if (vFrames?.length || gotAvcInitData) {
        codec4cc = CommonCodecFourCCs.avc1;
      } else {
        throw new Error('Expected either video or audio payload');
      }

      const parsedPktData = this._tsParser.prune();
      if (!parsedPktData) {
        throw new Error('Expected prune to return parsed data since new frames pop´d off before');
      }

      const pkt = Packet.fromSlice(BufferSlice.fromTypedArray(parsedPktData))
        .setTimingInfo(firstPtsUs, 0, MICROSECOND_TIMESCALE);

      pkt.properties.mimeType = CommonMimeTypes.VIDEO_MPEGTS;
      pkt.properties.codec = codec4cc;

      if (gotVideoKeyframe) {
        pkt.properties.isKeyframe = true;
      }
      if (gotAvcInitData) {
        pkt.properties.isBitstreamHeader = true;
      }

      this._timingRegulatorSock.transfer(pkt);
    }
  }
}
