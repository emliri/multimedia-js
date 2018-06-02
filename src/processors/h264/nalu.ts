export class NALU {

  static get NDR() { return 1; }
  static get IDR() { return 5; }
  static get SEI() { return 6; }
  static get SPS() { return 7; }
  static get PPS() { return 8; }
  static get AUD() { return 9; }

  static get TYPES() {
      return {
          [NALU.IDR]: 'IDR',
          [NALU.SEI]: 'SEI',
          [NALU.SPS]: 'SPS',
          [NALU.PPS]: 'PPS',
          [NALU.NDR]: 'NDR',
          [NALU.AUD]: 'AUD',
      };
  }

  static type(nalu: NALU): string {
      if (nalu.ntype in NALU.TYPES) {
          return NALU.TYPES[nalu.ntype];
      } else {
          return 'UNKNOWN';
      }
  }

  payload: Uint8Array;
  nri: number;
  ntype: number;

  constructor(data: Uint8Array) {
      this.payload = data;
      this.nri = (this.payload[0] & 0x60) >> 5;
      this.ntype = this.payload[0] & 0x1f;
  }

  toString(): string {
      return `${NALU.type(this)}: NRI: ${this.getNri()}`;
  }

  getNri() {
      return this.nri >> 6;
  }

  type(): number {
      return this.ntype;
  }

  isKeyframe() {
      return this.ntype == NALU.IDR;
  }

  getSize() {
      return 4 + this.payload.byteLength;
  }

  getData() {
      const result = new Uint8Array(this.getSize());
      const view = new DataView(result.buffer);
      view.setUint32(0, this.getSize() - 4);

      result.set(this.payload, 4);
      return result;
  }
}
