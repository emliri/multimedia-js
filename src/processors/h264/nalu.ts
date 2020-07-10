export enum H264SliceType {
  P = 0,
  B,
  I,
  SP,
  SI
}

export enum H264NaluType {
  NOI = 1,
  // TODO: add types 2 to 4
  IDR = 5,
  SEI = 6,
  SPS = 7,
  PPS = 8,
  AUD = 9,
  SEE = 10,
  STE = 11
}

export function getH264NaluTypeTag(nalType: H264NaluType): string {
  return H264NaluType[nalType].toLowerCase();
}

export class NALU {
  // TODO: make enum

  // TODO: remove

  static get NON_IDR () {
    return H264NaluType.NOI;
  }

  // TODO: add types 2 to 4

  static get IDR () {
    return H264NaluType.IDR;
  }

  static get SEI () {
    return H264NaluType.SEI;
  }

  static get SPS () {
    return H264NaluType.SPS;
  }

  static get PPS () {
    return H264NaluType.PPS;
  }

  static get AU_DELIM () {
    return H264NaluType.AUD;
  }

  static get SEQ_END () {
    return H264NaluType.SEE;
  }

  static get STREAM_END () {
    return H264NaluType.STE;
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
      return `${nalType} (unknown NAL type)`;
      // throw new Error('Unknown NALU type: ' + nalType);
    }
  }

  payload: Uint8Array;
  refIdc: number;
  nalType: number;

  constructor (data: Uint8Array) {
    if (data.byteLength < 2) {
      throw new Error('Data is to little bytes to be a NALU (needs at least 2 or more)')
    }
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

  /**
   * @deprecated
   * Redundant, see h264-tools.ts `makeAnnexBAccessUnitFromNALUs`
   */
  copyToAnnexBAccessUnit (): Uint8Array {
    const result = new Uint8Array(this.getAnnexBnalUnitSize());
    const view = new DataView(result.buffer);
    view.setUint32(0, this.getAnnexBnalUnitSize() - 4);
    result.set(this.payload, 4);
    return result;
  }
}
