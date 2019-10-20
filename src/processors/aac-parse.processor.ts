import { Processor, ProcessorEvent } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';

import { BufferSlice } from '../core/buffer';

import { getLogger, LoggerLevel } from '../logger';
import { Esds } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/esds';
import { parseAacADTSHeaderInfo, isAacADTSHeaderPattern } from './aac/adts-utils';
import { makeMp4AudioSpecificConfigInfoFromADTSHeader } from './aac/mp4a-audio-specific-config';

const { log, warn, error } = getLogger('AACParseProcessor', LoggerLevel.ON, true);

export class AACParseProcessor extends Processor {
  static getName (): string {
    return 'AACParseProcessor';
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
      this._onProcessingError.bind(this),
      this);

    this.out[0].transfer(
      p
    );

    return true;
  }

  private _onProcessingError (bufferSlice: BufferSlice, err: Error): boolean {
    error('error:', err);

    return false;
  }

  private _onBufferSlice (p: Packet, bufferSlice: BufferSlice) {
    if (p.defaultPayloadInfo) {
      if (p.defaultPayloadInfo.isBitstreamHeader) {
        log('packet has bitstream header flag');

        const esds: Esds = <Esds> Esds.parse(bufferSlice.getUint8Array());

        log('parsed MP4 audio-atom:', esds);
      }
      if (p.defaultPayloadInfo.isKeyframe) {
        log('packet has keyframe flag');
      }
    } else {
      warn('no default payload info');
    }

    const data = bufferSlice.getUint8Array();

    if (!isAacADTSHeaderPattern(data, 0)) {
      log('No ADTS header-pattern found');
      return;
    }

    log('AAC audio config:', makeMp4AudioSpecificConfigInfoFromADTSHeader(data, 0));

    log('ADTS header-info:', parseAacADTSHeaderInfo(data, 0, 0, 0, 0));
  }
}
