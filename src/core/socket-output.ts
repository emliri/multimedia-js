import { SocketDescriptor, SocketType } from './socket';
import { Packet } from './packet';
import { makeLogTimestamped, getLogger, LoggerLevel } from '../logger';
import { Signal, SignalReceiverCastResult, collectSignalReceiverCastResults } from './signal';
import { Socket } from './socket-base';
import { PayloadDescriptor, MimetypePrefix } from './payload-description';

const { log, error } = getLogger('SocketBase', LoggerLevel.ERROR);
export class OutputSocket extends Socket {
  static fromUnsafe (s: Socket): OutputSocket {
    return (<OutputSocket> s);
  }

  private peers_: Socket[] = [];

  constructor (descriptor: SocketDescriptor) {
    super(SocketType.OUTPUT, descriptor);
  }

  close () {
    this.disconnect();
    super.close();
  }

  protected transferSync (p: Packet): void {
    let result: boolean = true;
    this.setTransferring_(true);
    this.peers_.forEach((s) => {
      s.transfer(p);
    });
    this.setTransferring_(false);
  }

  /**
   * {Socket} Another socket to which this socket transfers data ownership to.
   */
  connect (s: Socket): OutputSocket {
    if (!s) {
      throw new Error('OutputSocket.connect called with falsy arg:' + s);
    }

    if (this.isConnectedTo(s)) {
      throw new Error('OutputSocket is already connected to peer');
    }

    if (s.getPeer()) {
      throw new Error('OutputSocket.connect target already has a peer (only one output can connect to any peer socket)');
    }
    s.setPeer(this);

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
        this.peers_.length = 0;
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
      peersOrOwner = this.owner_.cast(signal);
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
      return this.owner_.cast(signal);
    } else {
      return Promise.resolve(false);
    }
  }
}

export class ShadowOutputSocket extends OutputSocket {
  constructor (payloadShadowTypes: MimetypePrefix[], streamId?: number) {
    const sockDes = SocketDescriptor.fromPayloads(
      payloadShadowTypes.map(prefix => PayloadDescriptor.fromMimeTypeShadow(prefix)));
    if (Number.isFinite(streamId)) {
      sockDes.payload().elementaryStreamId = streamId;
    }
    super(sockDes);
  }
}
