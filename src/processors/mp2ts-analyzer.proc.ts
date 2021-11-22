import { BufferSlice, InputSocket, Packet, OutputSocket, SocketDescriptor, SocketTemplateGenerator, SocketType, CommonMimeTypes } from '../..';
import { orInfinity } from '../common-utils';
import { SocketTapTimingRegulate } from '../socket-taps';
import { mixinProcessorWithOptions } from '../core/processor';

import { Mpeg2TsSyncAdapter } from './mpeg2ts/mpeg2ts-sync-adapter';
import { MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';

import { Frame, Track } from '../ext-mod/inspector.js/src';
import { MpegTSDemuxer } from '../ext-mod/inspector.js/src/demuxer/ts/mpegts-demuxer'

import { getLogger, LoggerLevel } from '../logger';

import { MICROSECOND_TIMESCALE } from '../ext-mod/inspector.js/src/utils/timescale';

const { warn } = getLogger('Mp2TsAnalyzerProc', LoggerLevel.ON);

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
  private _opts: Mp2TsAnalyzerProcOpts;

  private _mptsSyncAdapter: Mpeg2TsSyncAdapter = new Mpeg2TsSyncAdapter();
  private _analyzePesBuffer: BufferSlice = null;
  private _timingRegulatorSock: OutputSocket;

  private _tsParser: MpegTSDemuxer = new MpegTSDemuxer();

  constructor (opts?: Partial<Mp2TsAnalyzerProcOpts>) {
    super();

    opts = this.setOptions(opts);
    this.createInput();
    this.createOutput();

    // configure the PTS based output regulation internal socket
    // and connect to proc out
    this._timingRegulatorSock
      = OutputSocket.fromUnsafe(
        new OutputSocket(this.templateSocketDescriptor(SocketType.OUTPUT))
        .setTap(new SocketTapTimingRegulate({
          timingRegulationOn: opts.enablePlayoutRegulation,
          timingRegulationSpeed: opts.playoutRegulationSpeed,
          timingRegulationPollMs: opts.playoutRegulationPollMs
        })))
        .connect(this.out[0]);

    this._tsParser.onPmtParsed = () => {
      //console.log('got PMT')
    }

  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_ (inS: InputSocket, p: Packet, inputIndex: number): boolean {
    this._mptsSyncAdapter.feed(p.data[0].getUint8Array());

    while (true) {
      const nextPktBuf: Uint8Array = this._mptsSyncAdapter.take(1, 1);
      if (!nextPktBuf) break;
      if (!this._analyzePesBuffer) {
        this._analyzePesBuffer = BufferSlice.fromTypedArray(nextPktBuf);
      } else {
        this._analyzePesBuffer = this._analyzePesBuffer.append(BufferSlice.fromTypedArray(nextPktBuf));
      }

      let aFrames: Frame[];
      let vFrames: Frame[];
      let gotVideoKeyframe = false;

      this._tsParser.append(nextPktBuf);

      Object.values(this._tsParser.tracks).forEach((track) => {
        const frames = track.popFrames();
        switch(track.type) {
        case Track.TYPE_VIDEO:
          frames.forEach((frame) => {
            gotVideoKeyframe = frame.frameType === Frame.IDR_FRAME;
          });
          vFrames = frames;
          break;
        case Track.TYPE_AUDIO:
          aFrames = frames;
          break;
        }
      });

      if ((aFrames && aFrames.length) || (vFrames && vFrames.length)) {
        const dts = Math.min(
          orInfinity(aFrames && aFrames.length && aFrames[0].timeUs),
          orInfinity(vFrames && vFrames.length && vFrames[0].timeUs)
        );
        if (Number.isFinite(dts)) {
          const pkt = Packet.fromSlice(this._analyzePesBuffer)
                            .setTimingInfo(dts, 0, MICROSECOND_TIMESCALE);

          if (gotVideoKeyframe) {
            pkt.defaultPayloadInfo.isKeyframe = true;
          }

          this._timingRegulatorSock.transfer(pkt);
          this._analyzePesBuffer = null;
        };
      }
    }

    return true;
  }




}

