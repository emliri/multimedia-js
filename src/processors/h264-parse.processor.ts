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
      //this._onProcessingError,
      null,
      this)

    return true
  }

  private _onProcessingError(bufferSlice: BufferSlice, err: Error): boolean {
    console.error('H264Parse error:', err)

    return false;

  }

  private _onBufferSlice(p: Packet, bufferSlice: BufferSlice) {
    const avcStream = bufferSlice.getUint8Array();
    const avcView = bufferSlice.getDataView();

    let length;

    for (let i = 0; i < avcStream.length; i += length) {

        length = avcView.getUint32(i);

        if (length > avcStream.length) {
          this.out[0].transfer(Packet.fromSlice(bufferSlice));
          break; // no NALUs, but forward data anyway
        }

        i += 4;

        const naluSlice = bufferSlice.unwrap(i, length);
        const naluBytes = naluSlice.getUint8Array();
        const nalu = new NALU(naluBytes);

        const type = nalu.type();

        console.log(naluBytes.byteLength)

        console.log(nalu.toString())

        if (type === NALU.IDR || type === NALU.SPS || type === NALU.PPS) {
          console.log(nalu.toString(), p.timestamp);
        }

        this.out[0].transfer(
          ///*
          Packet.fromSlice(
            naluSlice
          )
          //*/
          //Packet.fromArrayBuffer()
        )
    }
  }
}
