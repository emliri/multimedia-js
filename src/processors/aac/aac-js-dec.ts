
import { EventEmitter } from "eventemitter3";

const AacDecoder = require('../../ext-mod/aac.js/src/decoder');

var Aurora = require('../../ext-mod/aurora.js/build/aurora');

class AacJsAuroraDemuxer extends EventEmitter {

  pushBuffer(data: Uint8Array) {
    const avBuffer = new Aurora.AVBuffer(data);
    this.emit('data', avBuffer);
  }

  eos() {
    this.emit('end');
  }
}

export class AacJsDecoder {

  private _aacDemux: AacJsAuroraDemuxer = new AacJsAuroraDemuxer();
  private _aacDec = new AacDecoder(this._aacDemux, {});

  constructor() {

  }
}
