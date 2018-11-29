import { BufferSlices, BufferSlice } from './buffer';
import { UNKNOWN_MIMETYPE } from './payload-description';
import { BufferProperties } from './buffer-props';

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
   * used to recover a packet that was transferred from a another thread (worker) context (passed via a message-event).
   * the object is then a "dead" structure of metadata and needs to be reconstructed so it has "methods"
   * again on its instance. all buffer-slices need to be recovered as well. in JS terms, we have lost all of our
   * prototypical nature and are more of a 1-to-1 serialized snapshot of the object state from which we create
   * a new instance with the identical properties.
   * @param p
   */
  static fromTransferable (p: Packet): Packet {
    return Packet.fromData(p, p.data.map((bs) => BufferSlice.fromTransferable(bs)));
  }

  /**
   * same as above but we are creating copies of the buffer data as well.
   * this is usually done when we pass data from a processing thread (worker) into the control/user thread via a message.
   * the message is attached a copy of the original data which was processed in the thread in this case.
   * @param p
   */
  static makeTransferableCopy(p: Packet) {
    return Packet.fromData(p, p.data.map((bs) => BufferSlice.copy(bs)));
  }

  /**
   * Creates a new packet based on an existing ("dead") packets metadata and some arbitrary data that is passed in.
   * This is used to convert back and for packet-data to be attached to inter-thread messages.
   * @param p Expected to be only a state snapshot of a packet without the actual prototype applied (no methods)
   * @param data
   */
  private static fromData (p: Packet, data: BufferSlice[]) {

    const newPacket: Packet = new Packet(
      data,
      p.timestamp,
      p.presentationTimeOffset,
      p.createdAt,
      p.synchronizationId
    );
    if (p._symbol > 0) { // we need to access the private member here because the properties
                         // and methods are not present when the prototype wasn't called
                         // same for the methods below
                         // note: if we would apply the constructor on `p` it would also reset the values
      newPacket.symbol = p._symbol;
    }
    newPacket.setTimestampOffset(p._timestampOffset);
    newPacket.setTimescale(p._timescale);
    return newPacket;
  }

  static fromArrayBuffer (
    arrayBuffer: ArrayBuffer,
    mimeType?: string,
    bufferProps: BufferProperties = new BufferProperties(mimeType)): Packet {

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

  static fromSymbol (symbol: PacketSymbol) {
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
  private _timescale: number = 1; // maybe not have a default value?
  private _hasDefaultBufferProps: boolean = true;
  private _timestampOffset: number = 0;

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
            console.error('Packet-buffers loop aborted: ', err);
          }
        } else {
          throw err;
        }
      }
    });
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

  /**
   * alias for presentationTimeOffset
   */
  get cto() {
    return this.presentationTimeOffset;
  }

  /**
   * alias for presentationTimeOffset
   */
  get pto() {
    return this.presentationTimeOffset;
  }

  /**
   * alias for timestamp (caution: not including timestamp-offset)
   */
  get dts() {
    return this.timestamp;
  }

  /**
   * CT <==> PTS
   *
   * CT(n)  =  DT(n)  +  CTO(n)
   */
  getPresentationTimestamp (): number {
    return this._timestampOffset + this.timestamp + this.presentationTimeOffset;
  }

  getDecodingTimestamp (): number {
    return this._timestampOffset + this.timestamp;
  }

  setTimescale(timescale: number) {
    this._timescale = timescale;
  }

  getTimescale(): number {
    return this._timescale;
  }

  setTimestampOffset(tOffset: number) {
    this._timestampOffset = tOffset;
  }

  getTimestampOffset(): number {
    return this._timestampOffset;
  }

  /**
   * CTO == PTO == presentationTimeOffset
   */
  getNormalizedCto(): number {
    return this.presentationTimeOffset / this._timescale;
  }

  getNormalizedTimestampOffset(): number {
    return this._timestampOffset / this._timescale;
  }

  getNormalizedPts(): number {
    return this.getPresentationTimestamp() / this._timescale;
  }

  getNormalizedDts() {
    return this.getDecodingTimestamp() / this._timescale;
  }

  getScaledPts(timescale: number): number {
    return this.getNormalizedPts() * timescale;
  }

  getScaledDts(timescale: number): number {
    return this.getNormalizedDts() * timescale;
  }

  /**
   * CTO == PTO == presentationTimeOffset
   */
  getScaledCto(timescale): number {
    return this.getNormalizedCto() * timescale;
  }

  getTotalBytes () {
    return this.data.reduce((accu, buf: BufferSlice) => {
      return accu + buf.length;
    }, 0);
  }

  isSymbolic (): boolean {
    return this._symbol !== PacketSymbol.VOID && this.data.length === 0;
  }

  toString(): string {
    const p = this;
    const description
      = `<${p.defaultPayloadInfo ? p.defaultPayloadInfo.mimeType : UNKNOWN_MIMETYPE}>`
      + ` #{(@${p.getTimestampOffset()} + ${p.timestamp} + ∂${p.presentationTimeOffset}) / ${p.getTimescale()}`
      + ` -> ${p.getNormalizedDts()} + ∂${p.getNormalizedCto()} [s]} `
    return description;
  }

  /*
  isPayloadInfoConsistent(): boolean {
    throw new Error('not implemented');
  }
  */

}
