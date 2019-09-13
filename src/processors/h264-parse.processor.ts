import { Processor, ProcessorEvent } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';

import { BufferSlice } from '../core/buffer';

import { getLogger, LoggerLevel } from '../logger';
import { debugAccessUnit } from './h264/h264-tools';
import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';

const { log, warn, error } = getLogger('H264ParseProcessor', LoggerLevel.OFF, true);

export class H264ParseProcessor extends Processor {
  static getName (): string {
    return 'H264ParseProcessor';
  }

  constructor () {
    super();

    this.createInput();
    this.createOutput();
  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return new SocketDescriptor();
  }

  protected processTransfer_ (inS: InputSocket, p: Packet) {
    log('parsing packet:', p.toString());

    p.forEachBufferSlice(
      this._onBufferSlice.bind(this, p),
      null,
      // this._onProcessingError.bind(this),
      this);

    this.out[0].transfer(
      p
    );

    return true;
  }

  private _onProcessingError (bufferSlice: BufferSlice, err: Error): boolean {
    error('H264Parse error:', err);

    return false;
  }

  private _onBufferSlice (p: Packet, bufferSlice: BufferSlice) {
    if (p.defaultPayloadInfo) {
      if (p.defaultPayloadInfo.isBitstreamHeader) {
        log('packet has bitstream header flag');

        const avcC: AvcC = <AvcC> AvcC.parse(bufferSlice.getUint8Array());

        log('parsed MP4 video-atom:', avcC);
      }
      if (p.defaultPayloadInfo.isKeyframe) {
        log('packet has keyframe flag');
      }
    } else {
      warn('no default payload info');
    }

    debugAccessUnit(bufferSlice, true);
  }
}
