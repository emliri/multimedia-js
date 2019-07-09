export class NALU {

  // TODO: make enum

  static get NON_IDR () {
    return 1;
  }

  static get IDR () {
    return 5;
  }

  static get SEI () {
    return 6;
  }

  static get SPS () {
    return 7;
  }

  static get PPS () {
    return 8;
  }

  static get AU_DELIM () {
    return 9;
  }

  static get SEQ_END () {
    return 10;
  }

  static get STREAM_END () {
    return 11;
  }

  payload: Uint8Array;
  nri: number;
  ntype: number;

  constructor (data: Uint8Array) {
    this.payload = data;
    this.nri = (this.payload[0] & 0x60) >> 5;
    this.ntype = this.payload[0] & 0x1f;
  }

  getAnnexBnalUnitSize () {
    return 4 + this.payload.byteLength;
  }

  copyToAnnexBnalUnit (): Uint8Array {
    const result = new Uint8Array(this.getAnnexBnalUnitSize());
    const view = new DataView(result.buffer);
    view.setUint32(0, this.getAnnexBnalUnitSize() - 4);
    result.set(this.payload, 4);
    return result;
  }
}
