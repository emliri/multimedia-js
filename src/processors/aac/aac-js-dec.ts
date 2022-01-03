
import { EventEmitter } from "eventemitter3";

const AacDecoder = require('../../ext-mod/aac.js/src/decoder');
const AuroraAv = require('../../ext-mod/aac.js/src/av');

class AacJsAuroraDemuxerShim extends EventEmitter {

  pushBuffer(data: Uint8Array) {
    const avBuffer = new AuroraAv.Buffer(data);
    this.emit('data', avBuffer);
  }

  eos() {
    this.emit('end');
  }
}

export type AacJsDecoderConfig = {
  profile: number
  samplingIndex: number
  channels: number
}

export class AacJsDecoder {

  private _aacDemux: AacJsAuroraDemuxerShim = new AacJsAuroraDemuxerShim();
  private _aacDec = new AacDecoder(this._aacDemux, {});

  constructor(header: AacJsDecoderConfig = {
    profile: 2,
    samplingIndex: 4,
    channels: 2
  }) {
    this._aacDec.on('data', (data) => {
      this.onData(data);
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

  dispose() {
    this._aacDemux.eos();
    this._aacDemux.removeAllListeners();
    this._aacDemux = null;
    this._aacDec = null;
  }

  pushBuffer(buf: Uint8Array) {
    if (!this._aacDemux) {
      throw new Error('Decoder already disposed, cant push data');
    }
    this._aacDemux.pushBuffer(buf);
    this._aacDec.decode();

  }

  onData(data: Float32Array) {
    console.log(data);
  }

  onEos() {
    console.log('AAC.js "end" event (EOS)');
  }

  onError(err: Error) {
  }
}
