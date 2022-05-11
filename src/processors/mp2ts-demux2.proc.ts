import { Processor, ProcessorEvent } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { CommonMimeTypes, CommonCodecFourCCs, MimetypePrefix } from '../core/payload-description';
import { ShadowOutputSocket } from '../core/socket-output';

import { printNumberScaledAtDecimalOrder } from '../common-utils';
import { getLogger, LoggerLevel } from '../logger';
import { getPerfNow } from '../perf-ctx';

import { mpeg2TsClockToSecs, MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';
import { debugNALU, H264NaluType, parseNALU } from './h264/h264-tools';

import { H264ParameterSetParser } from '../ext-mod/inspector.js/src/codecs/h264/param-set-parser';

import { MpegTSDemuxer } from '../ext-mod/inspector.js/src/demuxer/ts/mpegts-demuxer';
import { Track } from '../ext-mod/inspector.js/src/demuxer/track';

const { debug, log, info, warn } = getLogger('Mp2TsDemuxProc2', LoggerLevel.OFF, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // input
    SocketDescriptor.fromMimeTypes(
      'audio/mpeg', 'audio/adts',
      'video/h264',
      'application/cea-608',
      'application/unknown') // output
  );

export class Mp2TsDemuxProc2 extends Processor {
  static getName (): string {
    return 'Mp2TsDemuxProc2';
  }

  private _tsParser: MpegTSDemuxer = new MpegTSDemuxer();

  private _outPackets: Packet[] = [];

  private _audioSocket: OutputSocket = null;
  private _videoSocket: OutputSocket = null;
  private _videoSeiOutSocket: OutputSocket = null;
  private _metadataSocketMap: {[pid: number]: OutputSocket} = {};

  constructor () {
    super();
    this.createInput();

    this._tsParser.onProgramMapUpdate = this._onPmtUpdated.bind(this);
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_ (sock: InputSocket, p: Packet) {
    const pktData = p.data[0].getUint8Array();
    this._tsParser.append(pktData);
    // free fully parsed packet data
    this._tsParser.prune();
    return true;
  }

  private _onPmtUpdated () {
    Object.values(this._tsParser.tracks).forEach((track) => {
      switch (track.type) {
      case Track.TYPE_AUDIO:
        track.pes.onPayloadData = this._onAudioPayload.bind(this);
        break;
      case Track.TYPE_VIDEO:
        track.pes.onPayloadData = this._onVideoPayload.bind(this);
        break;
      }
    });
  }

  private _onAudioPayload (data: Uint8Array, timeMs: number) {
    if (!this._audioSocket) {
      // this._audioSocket = this.createOutput(SocketDescriptor.fromBufferProps(packet.properties));
    }
  }

  private _onVideoPayload (data: Uint8Array, timeMs: number, naluType: number) {
    if (!this._videoSocket) {
      // this._videoSocket = this.createOutput(SocketDescriptor.fromBufferProps(packet.properties));
    }
  }
}
