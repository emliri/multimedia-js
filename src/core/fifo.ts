import { Packet } from './packet';
import { InputSocket, SocketDescriptor, OutputSocket } from './socket';
import { VoidCallback } from '../common-types';

export class FifoQueue extends InputSocket {
  private _packets: Packet[] = [];

  constructor (
    private _onPacketWasQueued: VoidCallback = () => {},
    descr: SocketDescriptor = new SocketDescriptor()) {
    super((p: Packet) => this._onReceive(p), descr);
  }

  peek (): Packet {
    if (this._packets.length === 0) {
      return null;
    }
    return this._packets[this._packets.length - 1];
  }

  pop (): Packet {
    if (this._packets.length === 0) {
      return null;
    }
    return this._packets.shift();
  }

  dequeue(): Packet {
    if (this._packets.length === 0) {
      return null;
    }
    return this._packets.pop();
  }

  drop() {
    this._packets = [];
  }

  get length(): number {
    return this._packets.length;
  }

  private _onReceive (p: Packet): boolean {
    this._push(p);
    return true;
  }

  private _push (p: Packet) {
    this._packets.push(p);
    this._onPacketWasQueued();
  }
}

export class FifoValve extends OutputSocket {

  constructor(
    private _queue: FifoQueue,
    sd: SocketDescriptor
  ) {
    super(sd);
  }

  get queue() { return this._queue; }

  passOne() {
    this.transfer(this._queue.pop());
  }

  drain() {
    while(this._queue.length) {
      this.passOne();
    }
  }
}

export function wrapOutputSocketWithValve(
  output: OutputSocket,
  onPacketWasQueued: VoidCallback = () => {}): FifoValve {

  const q = new FifoQueue(onPacketWasQueued)
  output.connect(q)

  return new FifoValve(q, output.descriptor())
}


