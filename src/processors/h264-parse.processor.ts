import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

import {CommonMimeTypes} from '../core/mime-type'

import { BufferSlice, BufferProperties } from '../core/buffer';

import { H264Reader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/h264-reader';
import { BitReader } from '../ext-mod/inspector.js/src/utils/bit-reader';
import { H264Parser } from './h264/h264';
import { NALU } from './h264/nalu';

export class H264ParseProcessor extends Processor {

  private h264Reader: H264Reader;

  private h264Parser: H264Parser = new H264Parser();

  constructor() {
    super()
    this.createInput()
    this.createOutput()
  }

  templateSocketDescriptor(st: SocketType): SocketDescriptor {
    return new SocketDescriptor()
  }

  protected processTransfer_(inS: InputSocket, p: Packet) {

    p.forEachBufferSlice(
      this._onBufferSlice.bind(this, p),
      this._onProcessingError,
      this)

    return true
  }

  private _onProcessingError(bufferSlice: BufferSlice, err: Error) {
    console.error('H264Parse error:', err)
  }

  private _onBufferSlice( p: Packet, bufferSlice: BufferSlice) {
    const avcStream = bufferSlice.getUint8Array();
    const avcView = bufferSlice.getDataView();
    const result = [];
    let length;

    for (let i = 0; i < avcStream.length; i += length) {
        length = avcView.getUint32(i);

        i += 4;

        const naluBytes = bufferSlice.unwrap(i, length).getUint8Array();
        const nalu = new NALU(naluBytes);

        if (nalu.type() === NALU.IDR) {
          console.log(nalu.toString(), p.timestamp);
        }

        this.out[0].transfer(
          Packet.fromSlice(
            bufferSlice.unwrap(i - 4, length + 4, bufferSlice.props)
          )
        )
    }


  }
}
