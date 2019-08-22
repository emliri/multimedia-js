import { Socket, SocketDescriptor, SocketType, SocketEvent } from "./socket";
import { PacketReceiveCallback, Packet, PacketSymbol } from "./packet";
import { Signal, SignalReceiverCastResult, collectSignalReceiverCastResults } from "./signal";

export class InputSocket extends Socket {
  static fromUnsafe (s: Socket): InputSocket {
    return (<InputSocket> s);
  }

  static fromFunction (func: PacketReceiveCallback): InputSocket {
    return new InputSocket(func, new SocketDescriptor());
  }

  private onReceive_: PacketReceiveCallback;

  constructor (onReceive: PacketReceiveCallback, descriptor: SocketDescriptor) {
    super(SocketType.INPUT, descriptor);
    this.onReceive_ = onReceive;
  }

  transferSync (p: Packet): boolean {
    this.setTransferring_(true);
    const b = this.onReceive_(p);
    this._onTransferred(p);
    this.setTransferring_(false);
    return b;
  }

  /**
   * Overloads Socket cast method and also casts signal to owner as well as calling
   * super class cast, which call handler.
   */
  cast (s: Signal): SignalReceiverCastResult {
    return collectSignalReceiverCastResults([
      this.owner.cast(s),
      super.cast(s)
    ]);
  }

  private _onTransferred (p: Packet) {
    this._emit(SocketEvent.ANY_PACKET_RECEIVED);
    if (p.isSymbolic()) {
      switch (p.symbol) {
      case PacketSymbol.EOS:
        this._emit(SocketEvent.EOS_PACKET_RECEIVED);
        break;
      default:
        break;
      }
    } else {
      this._emit(SocketEvent.DATA_PACKET_RECEIVED);
    }
  }
}
