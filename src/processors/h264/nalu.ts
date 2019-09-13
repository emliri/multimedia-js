export enum H264SliceType {
  P = 0,
  B,
  I,
  SP,
  SI
}

export class NALU {
  // TODO: make enum

  static get NON_IDR () {
    return 1;
  }

  // TODO: add types 2 to 4

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

  static getNALUnitTypeName (nalType: number): string {
    switch (nalType) {
    case NALU.NON_IDR:
      return 'NON_IDR_SLICE';
    case NALU.SEI:
      return 'SEI';
    case NALU.PPS:
      return 'PPS';
    case NALU.SPS:
      return 'SPS';
    case NALU.AU_DELIM:
      return 'AUD';
    case NALU.IDR:
      return 'IDR';
    case NALU.SEQ_END:
      return 'END SEQUENCE';
    case NALU.STREAM_END:
      return 'END STREAM';
    default:
      return 'Unknown NALU type: ' + nalType;
            // throw new Error('Unknown NALU type: ' + nalType);
    }
  }

  payload: Uint8Array;
  refIdc: number;
  nalType: number;

  constructor (data: Uint8Array) {
    this.payload = data;
    this.refIdc = (this.payload[0] & 0x60) >> 5;
    this.nalType = this.payload[0] & 0x1f;
  }

  getTypeName (): string {
    return NALU.getNALUnitTypeName(this.nalType);
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
