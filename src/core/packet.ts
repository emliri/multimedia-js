import {BufferSlices, BufferSlice, BufferProperties} from './buffer';

export enum PacketSymbol {
  VOID,
  INIT,
  GAP,
  FLUSH,
  EOS
}

export class Packet {

  /**
   * See BufferSlice.fromTransferable
   * @param p
   */
  static fromTransferable(p: Packet): Packet {
    const newPacket: Packet = new Packet(
      p.data.map((bs) => BufferSlice.fromTransferable(bs)),
      p.timestamp,
      p.presentationTimeOffset,
      p.createdAt
    );
    if (p._symbol > 0) {
      newPacket.symbol = p._symbol;
    }
    return newPacket;
  }

  static fromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    mimeType?: string,
    sampleDuration?: number,
    samplesCount?: number): Packet {

    const p = new Packet();
    const bufferProps = new BufferProperties(mimeType, sampleDuration, samplesCount);

    return Packet.fromSlice(new BufferSlice(
      arrayBuffer,
      0,
      arrayBuffer.byteLength,
      bufferProps
    ))
  }

  static fromSlice(bufferSlice: BufferSlice, timestamp?: number, pto?: number): Packet {
    const p = new Packet([], timestamp, pto);

    p.data.push(
      bufferSlice
    )

    return p;
  }

  static fromSymbol(symbol: PacketSymbol) {
    const p = new Packet();
    p.symbol = symbol;
    return p;
  }

  static newEos() {
    return Packet.fromSymbol(PacketSymbol.EOS)
  }

  static newFlush() {
    return Packet.fromSymbol(PacketSymbol.FLUSH)
  }

  static newGap() {
    return Packet.fromSymbol(PacketSymbol.GAP)
  }

  static newInit() {
    return Packet.fromSymbol(PacketSymbol.INIT)
  }

  private _symbol: PacketSymbol = PacketSymbol.VOID;

  constructor(
    public data: BufferSlices = [],
    public timestamp: number = 0,
    public presentationTimeOffset: number = 0,
    public createdAt: Date = new Date()
  ) {}

  get symbol(): PacketSymbol {
    return this._symbol;
  }

  set symbol(symbol: PacketSymbol) {
    if (this.data.length > 0) {
      throw new Error('Symbolic packets should not carry data');
    }
    this._symbol = symbol;
  }

  isSymbolic(): boolean {
    return this._symbol !== PacketSymbol.VOID && this.data.length === 0;
  }

  getPresentationTime(): number {
    return this.timestamp + this.presentationTimeOffset;
  }

  mapArrayBuffers(): ArrayBuffer[] {
    return  BufferSlice.mapArrayBuffers(this.data);
  }

  forEachBufferSlice(
    method: (bs: BufferSlice) => void,
    errorHandler: (bs: BufferSlice, err: Error) => boolean = null,
    context: any = null) {

    let abort = false;
    // we use an on-stack shallow copy of the array to prevent any
    // side-effects on other manipulation of the packet itself from within
    // the loop we will run here.
    this.data.slice().forEach((bufferSlice) => {
      if (abort) {
        return;
      }
      if (context) {
        method = method.bind(context)
        if (errorHandler) {
          errorHandler = errorHandler.bind(context)
        }
      }
      try {
        method(bufferSlice)
      } catch(err) {
        if (errorHandler) {
          if (!errorHandler(bufferSlice, err)) {
            abort = true;
            console.error('Packet buffers loop aborted: ', err)
          }
        } else {
          throw err
        }
      }
    })
  }
}

export type PacketReceiveCallback = ((p: Packet) => boolean);

