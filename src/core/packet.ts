import { BufferSlices, BufferSlice, BufferProperties } from './buffer';

/**
 * Symbols are passed into sockets and thus processors to convey in-band
 * information on the stream of packets.
 */
export enum PacketSymbol {
  VOID = 0,           // void: a placeholder
  WAIT = 1,           // further data received should not be processed (or transferred)
  WAIT_BUT_Q = 2,     // further data received may be processed but must be queued until transferred (wait for resume)
  RESUME = 3,         // further data received should be processed now and pipelined
  FLUSH = 4,          // data received before should now be flushed (meaning it should be transferred when already processed)
  GAP = 5,            // a time-plane discontinuity in this sync-id domain will arrive after this (this may also mean a lack of data for present processing)
  EOS = 6,            // no more data will be transferred after this
  DROP = 7,           // data received before (already processed or not) should be dropped (and thus not transferred)
  DROP_Q = 8,         // data received before that was queued (not yet processed) should be dropped
  SYNC = 9            // after this, a new packet sync-id may appear (the symbolic packet SHOULD carry its value already)
}

export type PacketReceiveCallback = ((p: Packet) => boolean);

export class Packet {

  /**
   * See BufferSlice.fromTransferable
   */
  static fromTransferable (p: Packet): Packet {
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

  static fromArrayBuffer (
    arrayBuffer: ArrayBuffer,
    mimeType?: string,
    codec?: string,
    sampleDuration?: number,
    samplesCount?: number): Packet {

    const bufferProps = new BufferProperties(mimeType, sampleDuration, samplesCount);

    bufferProps.codec = codec;

    return Packet.fromSlice(new BufferSlice(
      arrayBuffer,
      0,
      arrayBuffer.byteLength,
      bufferProps
    ));
  }

  static fromSlice (bufferSlice: BufferSlice, timestamp?: number, pto?: number): Packet {
    const p = new Packet([], timestamp, pto);
    p.data.push(
      bufferSlice
    );
    return p;
  }

  static fromSlices(timestamp: number, pto: number, ...bufferSlices: BufferSlice[]): Packet {
    const p = new Packet([], timestamp, pto);
    Array.prototype.push.apply(p.data, bufferSlices);
    return p;
  }

  private static fromSymbol (symbol: PacketSymbol) {
    const p = new Packet();
    p.symbol = symbol;
    return p;
  }

  static newEos () {
    return Packet.fromSymbol(PacketSymbol.EOS);
  }

  static newFlush () {
    return Packet.fromSymbol(PacketSymbol.FLUSH);
  }

  static newGap () {
    return Packet.fromSymbol(PacketSymbol.GAP);
  }

  static newResume () {
    return Packet.fromSymbol(PacketSymbol.RESUME);
  }

  private _symbol: PacketSymbol = PacketSymbol.VOID;
  private _timescale: number = 1;
  private _hasDefaultBufferProps: boolean = true;
  private _timeOffset: number = 0;

  constructor (
    public data: BufferSlices = [],
    public timestamp: number = 0,
    public presentationTimeOffset: number = 0,
    public createdAt: Date = new Date(),
    public readonly synchronizationId: number = null
  ) {

    if (synchronizationId !== null && !Number.isSafeInteger(synchronizationId)) {
      throw new Error('Synchronization-id must be a safe integer value');
    }

  }

  get symbol (): PacketSymbol {
    return this._symbol;
  }

  set symbol (symbol: PacketSymbol) {
    if (this.data.length > 0) {
      throw new Error('Symbolic packets should not carry data');
    }
    this._symbol = symbol;
  }

  // TODO: allow to inject default payload as well from the packet
  get defaultPayloadInfo (): BufferProperties {
    if (!this.hasDefaultPayloadInfo) {
      throw new Error('packet has no default payload description');
    }
    return this.data[0] ? this.data[0].props : null;
  }

  // TODO: check if other buffers have other infos etc..
  get hasDefaultPayloadInfo(): boolean {
    return this._hasDefaultBufferProps;
  }

  /*
  isPayloadInfoConsistent(): boolean {
    throw new Error('not implemented');
  }
  */

  getTotalBytes () {
    return this.data.reduce((accu, buf: BufferSlice) => {
      return accu + buf.length;
    }, 0);
  }

  isSymbolic (): boolean {
    return this._symbol !== PacketSymbol.VOID && this.data.length === 0;
  }

  /**
   * CT <==> PTS
   *
   * CT(n)  =  DT(n)  +  CTO(n)
   */
  getPresentationTimestamp (): number {
    return this._timeOffset + this.timestamp + this.presentationTimeOffset;
  }

  getDecodingTimestamp (): number {
    return this._timeOffset + this.timestamp;
  }

  setTimescale(timescale: number) {
    this._timescale = timescale;
  }

  getTimescale(): number {
    return this._timescale;
  }

  setTimestampOffset(tOffset: number) {
    this._timeOffset = tOffset;
  }

  getTimestampOffset(): number {
    return this._timeOffset;
  }

  getNormalizedPts(): number {
    return this.getPresentationTimestamp() / this.getTimescale();
  }

  getNormalizedDts() {
    return this.getDecodingTimestamp() / this.getTimescale();
  }

  mapArrayBuffers (): ArrayBuffer[] {
    return BufferSlice.mapArrayBuffers(this.data);
  }

  forEachBufferSlice (
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
        method = method.bind(context);
        if (errorHandler) {
          errorHandler = errorHandler.bind(context);
        }
      }
      try {
        method(bufferSlice);
      } catch (err) {
        if (errorHandler) {
          if (!errorHandler(bufferSlice, err)) {
            abort = true;
            console.error('Packet buffers loop aborted: ', err);
          }
        } else {
          throw err;
        }
      }
    });
  }
}
