import { Processor, ProcessorEvent } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';

import { BufferSlice } from '../core/buffer';

/*
import { H264Reader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/h264-reader';
import { BitReader } from '../ext-mod/inspector.js/src/utils/bit-reader';
*/

import { H264Parser } from './h264/h264';
import { NALU } from './h264/nalu';

import { getLogger, LoggerLevels } from '../logger';

const {log, warn, error} = getLogger("H264ParseProcessor", LoggerLevels.LOG);

export class H264ParseProcessor extends Processor {

  static getName(): string { return "H264ParseProcessor" }

  // private h264Reader: H264Reader;

  private h264Parser: H264Parser = new H264Parser();

  constructor () {
    super();

    //this.on(ProcessorEvent.ANY_SOCKET_CREATED, () => {debugger});

    this.createInput();
    this.createOutput();


  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return new SocketDescriptor();
  }

  protected processTransfer_ (inS: InputSocket, p: Packet) {
    p.forEachBufferSlice(
      this._onBufferSlice.bind(this, p),
      this._onProcessingError.bind(this),
      this);

    return true;
  }

  private _onProcessingError (bufferSlice: BufferSlice, err: Error): boolean {
    error('H264Parse error:', err);

    return false;
  }

  private _onBufferSlice (p: Packet, bufferSlice: BufferSlice) {
    const avcStream = bufferSlice.getUint8Array();
    const avcView = bufferSlice.getDataView();

    let length;

    // console.log('got buffer of length:', avcStream.length)

    for (let i = 0; i < avcStream.length; i += length) {
      length = avcView.getUint32(i);

      if (length > avcStream.length) {
        warn('no NALUs found in this packet! Forwarding and ignoring:', p);
        this.out[0].transfer(p);
        break;
      }

      i += 4;

      const naluSlice = bufferSlice.unwrap(i, length);
      const naluBytes = naluSlice.getUint8Array();
      const nalu = new NALU(naluBytes);

      const type = nalu.type();

      // console.log(naluBytes.byteLength)
      // console.log(nalu.toString())

      if (type === NALU.IDR || type === NALU.SPS || type === NALU.PPS) {
        log(nalu.toString(), p.timestamp);
      }

      naluSlice.props.isKeyframe = (type === NALU.IDR);

      //log('timescale:', p.getTimescale())

      this.out[0].transfer(
        p
        /*
          Packet.fromSlice(
            bufferSlice // naluSlice // <- that would "unframe" the NALU bytes, like this we just pass through after parsing
          )
          // */
        // Packet.fromArrayBuffer()
      );
    }
  }
}
