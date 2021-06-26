import { BufferSlices, BufferSlice } from './buffer';
import { BufferProperties } from './buffer-props';
import { PacketDataModel } from './packet-model';
import { PacketSymbol } from './packet-symbol';
import { UNKNOWN_MIMETYPE } from './payload-description';

export { PacketSymbol } from './packet-symbol';

export type PacketReceiveCallback = ((p: Packet) => boolean);

export type PacketFilter = (p: Packet) => Packet;

export class Packet implements PacketDataModel {
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
  static makeTransferableCopy (p: Packet) {
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
      newPacket.setSymbol(p._symbol);
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

  static fromSlices (timestamp: number, pto: number, ...bufferSlices: BufferSlice[]): Packet {
    const p = new Packet([], timestamp, pto);
    Array.prototype.push.apply(p.data, bufferSlices);
    return p;
  }

  static fromSymbol (symbol: PacketSymbol) {
    const p = new Packet();
    p.setSymbol(symbol);
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
    private _synchronizationId: number = null
  ) {
    if (_synchronizationId !== null && !Number.isSafeInteger(_synchronizationId)) {
      throw new Error('Synchronization-id must be a safe integer value');
    }
  }

  get byteLength () {
    return this.getTotalBytes();
  }

  get dataSlicesLength () {
    return this.data ? this.data.length : 0;
  }

  get dataSlicesBytes (): number {
    return this.getTotalBytes();
  }

  get timeScale () {
    return this._timescale;
  }

  get timestampOffset () {
    return this._timestampOffset;
  }

  get symbol (): PacketSymbol {
    return this._symbol;
  }

  get defaultPayloadInfo (): BufferProperties {
    if (!this.hasDefaultPayloadInfo) {
      throw new Error('packet has no default payload description');
    }
    return this.data[0] ? this.data[0].props : null;
  }

  get defaultMimeType (): string {
    return this.defaultPayloadInfo ? this.defaultPayloadInfo.mimeType : null;
  }

  // TODO: check if other buffers have other infos etc..
  get hasDefaultPayloadInfo (): boolean {
    return this._hasDefaultBufferProps;
  }

  get synchronizationId (): number {
    return this._synchronizationId;
  }

  setTimingInfo (dts: number, cto: number = 0, timeScale = 1, timeOffset = 0): Packet {
    this.setTimescale(timeScale);
    this.setTimestampOffset(timeOffset);
    this.timestamp = dts;
    this.presentationTimeOffset = cto;
    return this;
  }

  setTimescale (timescale: number): Packet {
    this._timescale = timescale;
    return this;
  }

  setTimestampOffset (tOffset: number): Packet {
    this._timestampOffset = tOffset;
    return this;
  }

  setSynchronizationId (id: number): Packet {
    this._synchronizationId = id;
    return this;
  }

  setSymbol (symbol: PacketSymbol): Packet {
    if (this.data.length > 0) {
      throw new Error('Symbolic packets should not carry data');
    }
    this._symbol = symbol;
    return this;
  }

  isSymbolic (): boolean {
    return this._symbol !== PacketSymbol.VOID && this.data.length === 0;
  }

  getTotalBytes () {
    return this.data.reduce((accu, buf: BufferSlice) => {
      return accu + buf.length;
    }, 0);
  }

  getSymbolName (): string {
    return PacketSymbol[this.symbol];
  }

  toString (): string {
    const p = this;
    const description =
      `<${p.defaultPayloadInfo ? p.defaultPayloadInfo.mimeType : UNKNOWN_MIMETYPE}>` +
      ` #{(@${p.timestampOffset} + ${p.timestamp} + ∂${p.presentationTimeOffset}) / ${p.timeScale}` +
      ` -> ${p.getNormalizedDts()} => ∂${p.getNormalizedPts()} [s]}` +
      `k(${p.defaultPayloadInfo.isKeyframe ? '1' : '0'})|b(${p.defaultPayloadInfo.isBitstreamHeader ? '1' : '0'})`;
    return description;
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
    // side-effects on other manipulation of the puacket itself from within
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

  /**
   * alias for timestamp
   */
  getDts () {
    return this.timestamp;
  }

  getPts () {
    return this.timestamp + this.presentationTimeOffset;
  }

  /**
   * usual alias for PTO
   */
  getCto () {
    return this.presentationTimeOffset;
  }

  /**
   * PTS(n) = DTS(n) + PTO(n)
   */
  getPresentationTimeWithOffset (): number {
    return this._timestampOffset + this.timestamp + this.presentationTimeOffset;
  }

  getDecodeTimeWithOffset (): number {
    return this._timestampOffset + this.timestamp;
  }

  getNormalizedDts () {
    return this.getDecodeTimeWithOffset() / this.timeScale;
  }

  getNormalizedPts () {
    return this.getPresentationTimeWithOffset() / this.timeScale;
  }
}
