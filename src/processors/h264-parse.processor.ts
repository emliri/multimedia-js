import { Processor, ProcessorEvent } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';

import { BufferSlice } from '../core/buffer';

/*
import { H264Reader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/h264-reader';
import { BitReader } from '../ext-mod/inspector.js/src/utils/bit-reader';
*/

import { getLogger, LoggerLevel } from '../logger';
import { debugAccessUnit } from './h264/h264-tools';
import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';

const { debug, log, warn, error } = getLogger('H264ParseProcessor', LoggerLevel.ON, true);

export class H264ParseProcessor extends Processor {
  static getName (): string {
    return 'H264ParseProcessor';
  }

  constructor () {
    super();

    // this.on(ProcessorEvent.ANY_SOCKET_CREATED, () => {debugger});

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
      this._onProcessingError.bind(this),
      this);

    // NOTE: atm the h264 parser only "inspects" the data and then passes through each packet unmodified

    this.out[0].transfer(
      p
      /*
        Packet.fromSlice(
          bufferSlice // naluSlice // <- that would "unframe" the NALU bytes, like this we just pass through after parsing
        )
        // */
      // Packet.fromArrayBuffer()
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
        log('packet has bitstream header flag')

        const avcC: AvcC = <AvcC> AvcC.parse(bufferSlice.getUint8Array());

        log('parsed MP4 video-atom:', avcC);
      }
      if (p.defaultPayloadInfo.isKeyframe) {
        log('packet has keyframe flag')
      }
    } else {
      warn('no default payload info')
    }

    debugAccessUnit(bufferSlice, true);

  }
}
