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

import { orInfinity, prntprtty } from '../common-utils';
import { getLogger, LoggerLevel } from '../logger';

import { mixinProcessorWithOptions } from '../core/processor';
import { CommonCodecFourCCs } from '../core/payload-description';

import { SocketTapTimingRegulate } from '../socket-taps';

import { Mpeg2TsSyncAdapter } from './mpeg2ts/mpeg2ts-sync-adapter';
import { MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';

import { Frame } from '../ext-mod/inspector.js/src';
import { MpegTSDemuxer } from '../ext-mod/inspector.js/src/demuxer/ts/mpegts-demuxer';
import { H264Reader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/h264-reader';
import { FRAME_TYPE } from '../ext-mod/inspector.js/src/codecs/h264/nal-units';
import { AdtsReader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/adts-reader';
import { TrackType } from '../ext-mod/inspector.js/src/demuxer/track';

const { warn, error } = getLogger('Mp2TsAnalyzerProc', LoggerLevel.OFF);

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
  playoutRegulationPollMs: DEFAULT_PLAYOUT_REGULATION_POLL_MS,
  passThrough: false
});

export type Mp2TsAnalyzerProcOpts = {
  enablePlayoutRegulation: boolean
  playoutRegulationSpeed: number
  playoutRegulationPollMs: number
  passThrough: boolean
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

    this._tsParser.onProgramMapUpdate = () => {
      // console.log('got PMT', prntprtty(this._tsParser.tracks))
    };
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_ (inS: InputSocket, p: Packet, inputIndex: number): boolean {
    if (this.options_.passThrough) {
      this.out[0].transfer(p);
      return true;
    }

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

    let spsPpsTimeDts: number;
    let audioRateHz: number;

    this._tsParser.append(mptsPktData);

    // console.debug("packet count:", this._tsParser.currentPacketCount);

    Object.values(this._tsParser.tracks).forEach((track) => {
      // console.debug(track.id, track.mimeType, "read frames:", track.frames.length, track.frames)

      // pops all frames of prior complete payload-units (until next PUSI)
      const frames = track.popFrames();

      // console.debug("complete frames popd:", frames.length, frames);

      // the fact that we pop all the tracks frames at this point
      // is related to the PES-type segmentation to which we default here below.
      // if we would want to run time-range segmentation across all PES
      // (for example for HLS output) we would need to collect the frames
      // in the analyzer instance state or not pop them here but based on
      // the segmentation criteria other than "1 frame of either PES".
      // then again, the PES-AU atomic segmentation done here can be
      // used as a canonical output to produce any other segmentation in principle.
      switch (track.type) {
      case TrackType.VIDEO:
        vFrames = frames;

        gotVideoKeyframe = frames.some(frame => frame.frameType === FRAME_TYPE.I);

        const h264Reader = (<H264Reader> track.pes.payloadReader);

        // checking PUSI-count ensures we await end of any current payload-unit,
        // as we may have 0 frames popped but still an SPS/PPS parsed.
        // OR: sps/pps can also come in 1 PUSI with prior p-frame,
        // in which case h264Reader internal counter is already reset after popFrames,
        // but frame count will be > 0.
        if ((h264Reader.getPusiCount() > 0 || vFrames.length) &&
          h264Reader.sps && h264Reader.pps) {
          // set our flag
          gotAvcInitData = true;
          spsPpsTimeDts = h264Reader.dts;
          // reset the codec-data state
          h264Reader.sps = null;
          h264Reader.pps = false;
        }

        break;
      case TrackType.AUDIO:
        const adtsReader = track.pes.payloadReader as AdtsReader;
        audioRateHz = adtsReader.currentSampleRate;
        aFrames = frames;
        break;
      }
    });

    const gotVideoPayload = vFrames?.length || gotAvcInitData;
    const gotAudioPayload = aFrames?.length;
    // pre-condition for code inside this block
    // is that at least one of the tracks has >= 1 frames.
    // either frames list can be undefined if there is no respective a/v track.
    if (!(gotAudioPayload || gotVideoPayload)) {
      return;
    }

    // we have this check here to assert in a specific mode
    // of segmentation which is default now (see above on popFrames).
    // but the above logic to gather first PTS
    // of either composed lists of A/V frames is more generic
    // and might thus be used for other future segmentation modes
    // for example solely time-range based but not across PES / codecs.
    // ATM we expect what the below assertions express only.
    if (gotAudioPayload && gotVideoPayload) {
      const errMsg = `Expected to have only one type of frames in this PES segmentation mode.
      Got audio: ${prntprtty(aFrames)} & video frames: ${prntprtty(vFrames)}`;
      throw new Error(errMsg);
    }

    // pre-condition for code inside this block
    // is that at least one of the tracks has >= 1 frames.
    // either frames list can be undefined if there is no respective a/v track.
    const firstDtsA = orInfinity(gotAudioPayload && aFrames[0].dts);
    // spsPpsTimeDts will only be defined if there were no video frames to get timing from.
    const firstDtsV = orInfinity(gotVideoPayload && (spsPpsTimeDts || vFrames[0].dts));
    // since we expect only either A or V frames, one will be = Infinity,
    // thus using min here is just a trick to keep it all in one codepath.
    let firstDts = Math.min(
      firstDtsA,
      firstDtsV
    );
    // this is needed to handle timeUs = 0.
    // based on the preconditions here
    // firstPtsUs = Infinity can only result
    // when one or more of the tracks first frame PTS = 0.
    if (firstDts === Infinity) firstDts = 0;

    let timeScale: number;
    let codec4cc: string;

    if (gotAudioPayload) {
      codec4cc = CommonCodecFourCCs.mp4a;
      timeScale = audioRateHz;
    } else if (gotVideoPayload) {
      codec4cc = CommonCodecFourCCs.avc1;
      timeScale = MPEG_TS_TIMESCALE_HZ;
    } else {
      throw new Error('Expected either video or audio payload');
    }

    const parsedPktData = this._tsParser.prune();
    if (!parsedPktData) {
      throw new Error('Expected prune to return parsed data since new frames pop´d off before');
    }

    const pkt = Packet.fromSlice(BufferSlice.fromTypedArray(parsedPktData))
      .setTimingInfo(firstDts, 0, timeScale);

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
