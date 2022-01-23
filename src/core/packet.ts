import { Nullable } from '../common-types';
import { orNull, orZero } from '../common-utils';
import { getPerfWallClockTime } from '../perf-ctx';
import { BufferSlices, BufferSlice } from './buffer';
import { BufferProperties } from './buffer-props';
import { PacketDataModel } from './packet-model';
import { PacketSymbol } from './packet-symbol';
import { UNKNOWN_MIMETYPE } from './payload-description';

export { PacketSymbol } from './packet-symbol';

export type PacketReceiveCallback = ((p: Packet) => boolean);

export type PacketFilter = (p: Packet) => Nullable<Packet>;

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

  static fromSlice (bufferSlice: Nullable<BufferSlice>, timestamp?: number, pto?: number): Packet {
    const p = new Packet([], timestamp, pto);
    if (bufferSlice) {
      p.data.push(
        bufferSlice
      );
    }
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

  static newLatencyProbe () {
    return Packet.fromSymbol(PacketSymbol.LATENCY_PROBE);
  }

  private _symbol: PacketSymbol = PacketSymbol.VOID;
  private _timescale: number = 1; // maybe not have a default value?
  private _timestampOffset: number = 0;
  private _clockTags: number[] = [];

  constructor (
    public data: BufferSlices = [],
    public timestamp: number = 0,
    public presentationTimeOffset: number = 0,
    public createdAt: number = getPerfWallClockTime(),
    private _synchronizationId: number = null
  ) {
    if (_synchronizationId !== null && !Number.isSafeInteger(_synchronizationId)) {
      throw new Error('Synchronization-id must be a safe integer value');
    }
  }

  get properties (): Nullable<BufferProperties> {
    return orNull(this?.data[0]?.props);
  }

  /**
   * @deprecated use `properties` getter instead (isofunctional).
   */
  get defaultPayloadInfo () {
    return this.properties;
  }

  /**
   * number amount of slices, length of list.
   */
  get dataSlicesLength () {
    return orZero(this?.data.length);
  }

  /**
   * sum of all slices bytes amount.
   * functional alias to getTotalBytes, but necessary here
   * to allow properties serialization (see packet-model).
   */
  get dataSlicesBytes () {
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

  get synchronizationId (): number {
    return this._synchronizationId;
  }

  setTimingInfo (dts: number, cto: number = 0, timeScale = 1, timeOffset = 0): Packet {
    this.timestamp = dts;
    this.presentationTimeOffset = cto;
    this._timescale = timeScale;
    this._timestampOffset = timeOffset;
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
      return accu + orZero(buf?.length);
    }, 0);
  }

  getSymbolName (): string {
    return PacketSymbol[this.symbol];
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

  putClockTag () {
    this._clockTags.push(getPerfWallClockTime());
  }

  getClockTags (): number[] {
    return this._clockTags.slice();
  }

  getClockTagsDiff (): number {
    if (this._clockTags.length > 1) {
      return this._clockTags[this._clockTags.length - 1] - this._clockTags[0];
    } else if (this._clockTags.length === 1) {
      return getPerfWallClockTime() - this._clockTags[0];
    } else {
      return NaN;
    }
  }

  getClockTagsDeltas (): number[] {
    const deltas = this._clockTags.map((val, i) => {
      if (i === this._clockTags.length - 1) {
        return getPerfWallClockTime() - val;
      }
      return this._clockTags[i + 1] - val;
    });
    deltas.unshift(this._clockTags[0] - this.createdAt);
    return deltas;
  }

  toString (): string {
    const p = this;
    const description =
      `<${p.properties ? p.properties.mimeType : UNKNOWN_MIMETYPE}>` +
      ` #{(@${p.timestampOffset} + ${p.timestamp} + ∂${p.presentationTimeOffset}) / ${p.timeScale}` +
      ` -> ${p.getNormalizedDts()} => ${p.getNormalizedPts()} [s]}` +
      `k(${p.properties.isKeyframe ? '1' : '0'})|b(${p.properties.isBitstreamHeader ? '1' : '0'})`;
    return description;
  }

  toJSON (): string {
    return JSON.stringify(this.toDataModel());
  }

  toDataModel (): PacketDataModel {
    return PacketDataModel.createFromPacket(this);
  }

  mapArrayBuffers (): ArrayBuffer[] {
    return BufferSlice.mapArrayBuffers(this.data);
  }

  forEachBufferSlice (
    method: (bs: BufferSlice) => void,
    errorHandler: (bs: BufferSlice, err: Error) => boolean = null,
    context: any = null) {
    let abort = false;
    if (context) {
      method = method.bind(context);
      if (errorHandler) {
        errorHandler = errorHandler.bind(context);
      }
    }
    // we use an on-stack shallow copy of the array to prevent any
    // side-effects on other manipulation of the packet itself from within
    // the loop we will run here.
    this.data.slice().forEach((bufferSlice) => {
      if (abort) {
        return;
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
}
