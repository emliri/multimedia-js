
import { EventEmitter } from "eventemitter3";

const AacDecoder = require('../../ext-mod/aac.js/src/decoder');
const Aurora = require('../../ext-mod/aurora.js/build/aurora');

class AacJsAuroraDemuxerShim extends EventEmitter {

  pushBuffer(data: Uint8Array) {
    const avBuffer = new Aurora.Buffer(data);
    this.emit('data', avBuffer);
  }

  eos() {
    this.emit('end');
  }
}

export class AacJsDecoder {

  private _aacDemux: AacJsAuroraDemuxerShim = new AacJsAuroraDemuxerShim();
  private _aacDec = new AacDecoder(this._aacDemux, {});

  constructor() {
    this._aacDec.on('data', (data) => {
      this.onData(data);
    });
    this._aacDec.on('end', () => {
      this.onEos();
    });
    this._aacDec.on('error', (err) => {
      this.onError(err);
    });

    // generate a magic cookie from the ADTS header
    const header = {
      profile: 2,
      samplingIndex: 4,
      chanConfig: 2
    }
    var cookie = new Uint8Array(2);
    cookie[0] = (header.profile << 3) | ((header.samplingIndex >> 1) & 7);
    cookie[1] = ((header.samplingIndex & 1) << 7) | (header.chanConfig << 3);
    this._aacDec.setCookie(new Aurora.Buffer(cookie));
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

  onData(data) {
    console.log(data);
  }

  onEos() {
    console.log('AAC.js "end" event (EOS)');
  }

  onError(err) {
    console.error(err);
  }
}
