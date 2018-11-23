import { Processor } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';

import { CommonMimeTypes } from '../core/payload-description';

import { MP3Parser, MP3ParserResult } from './mp3/mp3-parser';
import { BufferSlice, BufferProperties } from '../core/buffer';
import { getLogger } from '../ext-mod/inspector.js/src/utils/logger';
import { MPEGAudioFrame } from './mp3/mpeg-audio-parser';

const {log, debug, error} = getLogger('MP3ParseProcessor');

export class MP3ParseProcessor extends Processor {

  static getName(): string { return "MP3ParseProcessor" }

  constructor () {
    super();
    this.createInput();
    this.createOutput();
  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return new SocketDescriptor();
  }

  protected processTransfer_ (inS: InputSocket, p: Packet) {
    p.forEachBufferSlice(
      this._onBufferSlice,
      this._onProcessingError,
      this);

    return true;
  }

  private _onProcessingError (bufferSlice: BufferSlice, err: Error) {
    error('MP3Parse error:', err);

    return true;
  }

  private _onBufferSlice (bufferSlice: BufferSlice) {
    //log('onBufferSlice');

    const res: MP3ParserResult = MP3Parser.parse(bufferSlice.getUint8Array());

    log('parsed mp3 frames:', res.mp3Frames.length);

    let timestamp = 0;

    debug('parser result:', res);

    res.mp3Frames.forEach((frame: MPEGAudioFrame) => {

      const p: Packet = Packet.fromSlice(BufferSlice.fromTypedArray(frame.data), timestamp, 0);

      p.data[0].props = new BufferProperties(CommonMimeTypes.AUDIO_MP3, frame.frameDuration, 16, 1);
      p.data[0].props.codec = 'mp3a'; // .mp3?

      timestamp += frame.frameDuration;

      log('created new mp3 packet @:', p.timestamp)

      this.out[0].transfer(p);
    });
  }
}
