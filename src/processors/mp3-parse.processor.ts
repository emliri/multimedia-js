import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

import {CommonMimeTypes} from '../core/mime-type'

import { MP3Parser, MP3ParserResult } from './mp3/mp3-parser'
import { BufferSlice, BufferProperties } from '../core/buffer';

export class MP3ParseProcessor extends Processor {
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
      this._onBufferSlice,
      this._onProcessingError,
      this)

    return true
  }

  private _onProcessingError(bufferSlice: BufferSlice, err: Error) {
    console.error('MP3Parse error:', err)

    return true;
  }

  private _onBufferSlice(bufferSlice: BufferSlice) {

    //console.log('onBufferSlice');

    const res: MP3ParserResult = MP3Parser.parse(bufferSlice.getUint8Array())

    res.mp3Frames.forEach((frame) => {
      const p: Packet = Packet.fromArrayBuffer(
        frame.data.buffer,
        CommonMimeTypes.AUDIO_MP3,
        frame.frameDuration
      )

      this.out[0].transfer(p)

    })
  }
}
