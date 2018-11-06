import { Packet } from "./packet";
import { InputSocket, SocketDescriptor } from "./socket";

export class Fifo extends InputSocket {

  private _packets: Packet[] = [];

  constructor(
    private _onPacketWasQueued: () => void = () => {},
    descr: SocketDescriptor = new SocketDescriptor()) {

    super((p: Packet) => this._onReceive(p), descr);
  }

  peek(): Packet {
    if (this._packets.length === 0) {
      return null;
    }
    return this._packets[this._packets.length - 1];
  }

  pop(): Packet {
    if (this._packets.length === 0) {
      return null;
    }
    return this._packets.pop();
  }

  private _onReceive(p: Packet): boolean {
    this._push(p);
    return true;
  }

  private _push(p: Packet) {
    this._packets.push(p);
    this._onPacketWasQueued();
  }


}
