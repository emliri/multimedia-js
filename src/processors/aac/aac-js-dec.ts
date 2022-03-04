
import { EventEmitter } from 'eventemitter3';

import { Nullable } from '../../common-types';
import { isTypedArraySharingBuffer } from '../../common-utils';

import { splitRawAudioFrameToStereoChannels } from './aac-utils';

const AacDecoder = require('../../ext-mod/aac.js/src/decoder');
const AuroraAv = require('../../ext-mod/aac.js/src/av');

class AacJsAuroraDemuxerShim extends EventEmitter {
  pushBuffer (data: Uint8Array) {
    const avBuffer = new AuroraAv.Buffer(data);
    this.emit('data', avBuffer);
  }

  eos () {
    this.emit('end');
  }
}

export type AacJsDecoderConfig = {
  profile: number
  samplingIndex: number
  channels: number
}

export class AacJsDecoder {
  static get defaultConfig (): AacJsDecoderConfig {
    return {
      profile: 2,
      samplingIndex: 4,
      channels: 2
    };
  }

  private _aacDemux: AacJsAuroraDemuxerShim = new AacJsAuroraDemuxerShim();
  private _aacDec = new AacDecoder(this._aacDemux, {});

  constructor (header: Nullable<AacJsDecoderConfig>, enableStereoChannelSplit: boolean = false) {
    if (!header) {
      header = AacJsDecoder.defaultConfig;
    }

    if (enableStereoChannelSplit && header.channels !== 2) {
      throw new Error('Cant set enableStereoChannelSplit flag with channels != 2');
    }

    this._aacDec.on('data', (data: Float32Array) => {
      if (enableStereoChannelSplit) {
        this.onData(splitRawAudioFrameToStereoChannels(data));
      } else {
        this.onData([data]);
      }
    });
    this._aacDec.on('end', () => {
      this.onEos();
    });
    this._aacDec.on('error', (err) => {
      this.onError(err);
    });

    const cookie = new Uint8Array(2);
    cookie[0] = (header.profile << 3) | ((header.samplingIndex >> 1) & 7);
    cookie[1] = ((header.samplingIndex & 1) << 7) | (header.channels << 3);
    this._aacDec.setCookie(new AuroraAv.Buffer(cookie));
  }

  dispose () {
    this._aacDemux.eos();
    this._aacDemux.removeAllListeners();
    this._aacDemux = null;
    this._aacDec = null;
  }

  pushBuffer (buf: Uint8Array) {
    if (!this._aacDemux) {
      throw new Error('Decoder already disposed, cant push data');
    }
    this._aacDemux.pushBuffer(buf);
    this._aacDec.decode();
  }

  onData (data: Float32Array[]) {
    console.log('AAC.js-decoder output:', data);
  }

  onEos () {
    console.log('AAC.js-decoder EOS event');
  }

  onError (err: Error) {
    console.error('AAC.js-decoder error event:', err);
  }
}

export class AacJsDecoderWorkerContext {
  private _workerCtx = self as any;

  constructor (cfg: AacJsDecoderConfig = AacJsDecoder.defaultConfig,
    enableStereoChannelSplit: boolean = false) {
    if (!this._workerCtx.importScripts) {
      throw new Error('Class should only be constructed from Worker scope');
    }

    const dec: AacJsDecoder = new AacJsDecoder(cfg, enableStereoChannelSplit);

    const workerCtx: Worker = this._workerCtx as Worker;
    self.addEventListener('message', (event) => {
      const buf: Uint8Array = event.data;
      dec.pushBuffer(buf);
    });

    dec.onData = (audioFrame: Float32Array[]) => {
      const isSharingBuffer = audioFrame.some((buf) => isTypedArraySharingBuffer(buf));
      if (isSharingBuffer) {
        throw new Error('Cant transfer audio-frame, is not unique owner of its ArrayBuffer memory');
      }

      const transferData: ArrayBuffer[] = audioFrame.map(a => a.buffer);
      workerCtx.postMessage(transferData, transferData);
    };

    dec.onError = (err: Error) => {
      console.error(err);
    };

    dec.onEos = () => {
      console.warn('AAC-js worker: EOS');
    };
  }
}
