import { Processor } from '../core/processor';

import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';

import { getLogger, LoggerLevel } from '../logger';
import { PayloadDescriptor, PayloadCodec } from '../core/payload-description';
import { runMpegTsDemux } from './mpeg-ts/ts-demuxer-w';
import { debugAccessUnit, debugNALU } from './h264/h264-tools';
import { printNumberScaledAtDecimalOrder } from '../common-utils';

const { debug, log } = getLogger('MPEGTSDemuxProcessor', LoggerLevel.OFF, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac', 'application/cea-608') // output
  );

export class MPEGTSDemuxProcessor extends Processor {
  static getName (): string {
    return 'MPEGTSDemuxProcessor';
  }

  private _programMap: {[pid: number]: OutputSocket} = {};
  private _haveAudio: boolean = false;
  private _haveVideo: boolean = false;

  constructor () {
    super();
    this.createInput();
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected onTaskWorkerMessage (event: Event) {
    const p = Packet.fromTransferable((event as any).data.packet);

    if (p.isSymbolic()) {
      this.out.forEach((os) => os.transfer(p));
      return;
    }

    this._processDemuxerOutputPacket(p);
  }

  private _processDemuxerOutputPacket (p: Packet) {
    const bs = p.data[0];

    if (!this._haveVideo && PayloadCodec.isAvc(bs.props.codec)) {
      this._haveVideo = true;
    } else if (!this._haveAudio && PayloadCodec.isAac(bs.props.codec)) {
      this._haveAudio = true;
    }

    // set mpeg-ts timescale of 90000khz
    p.setTimescale(90000);

    this._getOutputForPayload(bs.props).transfer(p);
  }

  private _getOutputForPayload (payloadDescriptor: PayloadDescriptor): OutputSocket {
    const pid = payloadDescriptor.elementaryStreamId;
    if (this._programMap[pid]) {
      return this._programMap[pid];
    }
    log('creating new output for stream-id (PID):', pid, 'with codec:', payloadDescriptor.codec);
    const s = this._programMap[pid] = this.createOutput(new SocketDescriptor([payloadDescriptor]));
    return s;
  }

  protected processTransfer_ (inS: InputSocket, inPacket: Packet) {
    const perf = self.performance;

    const startDemuxingMs = perf.now();

    log(`calling demuxer routine with packet of ${printNumberScaledAtDecimalOrder(inPacket.getTotalBytes(), 6)} Mbytes`);

    const outputPackets: Packet[] = runMpegTsDemux(inPacket);

    const demuxingRunTimeMs = perf.now() - startDemuxingMs;

    log(`got ${outputPackets.length} output packets from running demuxer (perf-stats: this took ${demuxingRunTimeMs.toFixed(3)} millis doing)`);

    let audioSocket: OutputSocket = null;
    let videoSocket: OutputSocket = null;

    outputPackets.forEach((p: Packet) => {
      if (p.isSymbolic()) {
        log('got symbolic packet:', p.getSymbolName(), '(noop/ignoring)');
        return;
      }

      debug(`processing non-symbolic packet of ${p.getTotalBytes()} bytes`);

      if (p.defaultPayloadInfo.isVideo()) {
        if (!videoSocket) {
          log('creating video output socket');
          videoSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        // p.forEachBufferSlice((bs) => debugNALU(bs));

        debug('transferring video packet to default out');

        if (p.defaultPayloadInfo.isBitstreamHeader) {
          log('found bitstream header part in packet:', p.defaultPayloadInfo.tags);
        }

        videoSocket.transfer(p);
      } else if (p.defaultPayloadInfo.isAudio()) {
        if (!audioSocket) {
          log('creating audio output socket');
          audioSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        debug('transferring audio packet to default out');

        audioSocket.transfer(p);
      } else {
        throw new Error('Unsupported payload: ' + p.defaultMimeType);
      }
    });

    return true;
  }
}
