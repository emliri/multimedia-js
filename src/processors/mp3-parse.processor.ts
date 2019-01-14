import { Processor } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';

import { CommonMimeTypes } from '../core/payload-description';

import { MP3Parser, MP3ParserResult } from './mp3/mp3-parser';
import { BufferSlice } from '../core/buffer';
import { getLogger, LoggerLevel } from '../logger';
import { MPEGAudioFrame } from './mp3/mpeg-audio-parser';
import { BufferProperties } from '../core/buffer-props';

const {log, debug, error} = getLogger('MP3ParseProcessor', LoggerLevel.LOG);

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

      const samplesPerFrame = frame.frameDuration / frame.sampleDuration;
      const sampleRate = frame.headerRef.sampleRate;

      const props = new BufferProperties(
        CommonMimeTypes.AUDIO_MP3,
        sampleRate,
        16,
        1,
        samplesPerFrame, false, true);

      props.codec = 'mp3a'; // .mp3?
      props.details.samplesPerFrame = samplesPerFrame;
      props.details.numChannels = frame.headerRef.channelCount;
      props.details.constantBitrate = (8 * frame.data.byteLength) / (samplesPerFrame/sampleRate);

      log('new mp3 frame props:', props.toString());

      p.data[0].props = props;

      timestamp += frame.frameDuration;

      log('created new mp3 packet @:', p.timestamp)

      this.out[0].transfer(p);
    });
  }
}
