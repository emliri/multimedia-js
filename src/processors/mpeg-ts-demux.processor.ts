import { Processor } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';
import { getLogger, LoggerLevel } from '../logger';
import { initMpegTsDemux, feedMpegTsDemux } from './mpeg-ts/ts-demuxer-w';
import { debugAccessUnit, debugNALU } from './h264/h264-tools';
import { printNumberScaledAtDecimalOrder } from '../common-utils';

import TSDemuxer from './mpeg-ts/ts-demuxer';

const { debug, log, warn } = getLogger('MPEGTSDemuxProcessor', LoggerLevel.WARN, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac', 'application/cea-608') // output
  );

export class MPEGTSDemuxProcessor extends Processor {

  static getName (): string {
    return 'MPEGTSDemuxProcessor';
  }

  /*
  private _programMap: {[pid: number]: OutputSocket} = {};
  private _haveAudio: boolean = false;
  private _haveVideo: boolean = false;
  */

  private _audioSocket: OutputSocket = null;
  private _videoSocket: OutputSocket = null;

  private _firstDtsOffset90khz: number | null = null; // WIP: actually build a packet-filter for this which will set each packet time-offset on a sequence

  private _demux: TSDemuxer = initMpegTsDemux();

  constructor () {
    super();
    this.createInput();
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_ (inS: InputSocket, inPacket: Packet) {

    const perf = self.performance;

    const startDemuxingMs = perf.now()

    log(`feeding demuxer with packet of ${printNumberScaledAtDecimalOrder(inPacket.getTotalBytes(), 6)} Mbytes`)

    const outputPackets: Packet[] = feedMpegTsDemux(this._demux, inPacket);

    const demuxingRunTimeMs = perf.now() - startDemuxingMs;

    log(`got ${outputPackets.length} output packets from running demuxer (perf-stats: this took ${demuxingRunTimeMs.toFixed(3)} millis doing)`)

    let audioSocket: OutputSocket = this._audioSocket;
    let videoSocket: OutputSocket = this._videoSocket;

    outputPackets.forEach((p: Packet) => {

      //if (this._firstDtsOffset90khz)

      if (p.isSymbolic()) {
        log('got symbolic packet:', p.getSymbolName(), '(noop/ignoring)');
        return;
      }

      debug(`processing non-symbolic packet of ${p.getTotalBytes()} bytes`);

      if (!p.defaultPayloadInfo) {
        warn('packet has not default payload, dropping:', p.toString(), 'object:', p);
        return;
      }

      if (p.defaultPayloadInfo.isVideo()) {
        if (!videoSocket) {
          log('creating video output socket')
          this._videoSocket = videoSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        //p.forEachBufferSlice((bs) => debugNALU(bs));

        debug('transferring video packet to default out');

        if (p.defaultPayloadInfo.isBitstreamHeader) {
          log('found bitstream header part in packet:', p.defaultPayloadInfo.tags)
        }

        videoSocket.transfer(p);
      } else if (p.defaultPayloadInfo.isAudio()) {
        if (!audioSocket) {
          log('creating audio output socket')
          this._audioSocket = audioSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
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
