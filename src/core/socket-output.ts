import { Socket, SocketDescriptor, SocketType } from "./socket";
import { Packet } from "./packet";
import { log } from "util";
import { makeLogTimestamped } from "../logger";
import { Signal, SignalReceiverCastResult, collectSignalReceiverCastResults } from "./signal";

export class OutputSocket extends Socket {
  static fromUnsafe (s: Socket): OutputSocket {
    return (<OutputSocket> s);
  }

  private peers_: Socket[];

  constructor (descriptor: SocketDescriptor) {
    super(SocketType.OUTPUT, descriptor);
    this.peers_ = [];
  }

  transferSync (p: Packet): boolean {
    log(makeLogTimestamped('OutputSocket.transfer packet'));

    let b: boolean;
    this.setTransferring_(true);
    this.peers_.forEach((s) => {
      log('call transfer on peer socket');
      b = s.transferSync(p);
      this.onPacketTransferred_(s, b);
    });
    this.setTransferring_(false);
    return b;
  }

  /**
   * {Socket} Another socket to which this socket transfers data ownership to.
   */
  connect (s: Socket): OutputSocket {
    if (!s) {
      throw new Error('Socket connect called with ' + s);
    }

    if (this.isConnectedTo(s)) {
      throw new Error('Socket is already connected to peer');
    }
    this.peers_.push(s);

    // when we peer with a socket we set our internal handler
    s.setSignalHandler(this._onPeerSignalCast.bind(this, s));
    return this;
  }

  /**
   * Disconnects this socket from peer socket s (which this had previously connected with `connect` method)
   * If `null` or default is passed, all peer sockets are disconnected.
   * If socket passed is not a peer socket, will throw an error.
   * @param s
   */
  disconnect (s: Socket = null): OutputSocket {
    if (!s) {
      if (this.hasPeers()) {
        this.peers_.splice(0, this.peers_.length);
      }
      return;
    }
    const index = this.peers_.indexOf(s);
    if (index < 0) {
      throw new Error('Socket can not be disconnected as its not connected');
    }
    this.peers_.splice(index, 1);
    return this;
  }

  isConnectedTo (s: Socket) {
    const index = this.peers_.indexOf(s);
    return index >= 0;
  }

  getPeerSockets (): Socket[] {
    return this.peers_;
  }

  getNumberOfPeers (): number {
    return this.peers_.length;
  }

  hasPeers (): boolean {
    return this.getNumberOfPeers() > 0;
  }

  /**
   * Cast a signal from this socket.
   *
   * When signal travels down, broadcast to all peer sockets.
   *
   * All other cases (zero or up direction), broadcast to owner.
   *
   * Also calls the super-class implementation and collects results together.
   */
  cast (signal: Signal): SignalReceiverCastResult {
    let peersOrOwner: SignalReceiverCastResult;
    if (signal.isDirectionDown()) {
      peersOrOwner = signal.emit(this.peers_);
    } else {
      peersOrOwner = this.owner.cast(signal);
    }
    return collectSignalReceiverCastResults([
      super.cast(signal),
      peersOrOwner
    ]);
  }

  /**
   * Handler set on all peer sockets, called when they cast a signal.
   *
   * When the signal is up, we cast it to our socket owner.
   *
   * When it travels down, we don't need to do anything and return a
   * negative result (since we did not handle the signal)
   *
   */
  private _onPeerSignalCast (peerSocket: Socket, signal: Signal): SignalReceiverCastResult {
    if (signal.isDirectionUp()) {
      return this.owner.cast(signal);
    } else {
      return Promise.resolve(false);
    }
  }

  private onPacketTransferred_ (peerSocket: Socket, peerTransferReturnVal: boolean) {
    switch (peerSocket.type()) {
    case SocketType.INPUT:
      this.onPacketTransferredToPeerInput_(peerTransferReturnVal);
      break;
    case SocketType.OUTPUT:
      this.onPacketTransferredToPeerOutput_(peerTransferReturnVal);
      break;
    }
  }

  private onPacketTransferredToPeerInput_ (peerTransferReturnVal: boolean) {}
  private onPacketTransferredToPeerOutput_ (peerTransferReturnVal: boolean) {}
}
