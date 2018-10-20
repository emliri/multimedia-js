import { PayloadDescriptor } from './mime-type';
import { Packet, PacketReceiveCallback } from './packet';

import { getLogger, makeLogTimestamped, LoggerLevels } from '../logger';
import { Signal, SignalHandler, SignalReceiver, SignalReceiverCastResult, collectSignalReceiverCastResults } from './signal';

const { log } = getLogger('Socket', LoggerLevels.OFF);

export enum SocketType {
    INPUT,
    OUTPUT
}

export class SocketState {
    transferring: boolean;

    constructor () {
      this.transferring = false;
    }
}

export class SocketDescriptor {
    payloads: PayloadDescriptor[];

    constructor (payloads?: PayloadDescriptor[]) {
      this.payloads = payloads || [];
    }
}

export abstract class SocketOwner implements SignalReceiver {
    abstract getOwnSockets(): Set<Socket>;
    abstract cast(signal: Signal): SignalReceiverCastResult;
}

export abstract class Socket implements SignalReceiver {
    private type_: SocketType;
    private state_: SocketState;
    private descriptor_: SocketDescriptor;
    private signalHandler_: SignalHandler = null;

    protected owner: SocketOwner = null;

    constructor (type: SocketType, descriptor: SocketDescriptor) {
      this.type_ = type;
      this.descriptor_ = descriptor;
      this.state_ = new SocketState();
    }

    type (): SocketType {
      return this.type_;
    }

    payloads (): PayloadDescriptor[] {
      return this.descriptor_.payloads;
    }

    /**
     * Read transferring flag of socket state.
     */
    isTransferring (): boolean {
      return this.state_.transferring;
    }

    /**
     * For subclasses only. Set the transfering flag of the socket state.
    b
     */
    protected setTransferring_ (b: boolean) {
      this.state_.transferring = b;
    }

    /**
     * Transfer the partial ownership of a Packet to this Socket.
     *
     * Return `false` value may indicate that the socket is not peered
     * and thus no effective transfer took place, or that the data processing handler
     * is not set in some other way, or an error was thrown when processing.
    p
     */
    abstract transfer(p: Packet): boolean;

    /**
     * Passes the signal to the handler.
     * The default implementation is a synchrneous call,
     * but this may be anything asynchrneous and/or RPC'd in sub-classes,
     * since the SignalHandler is designed to return a Promise.
     *
     * The idea by default is that sockets pass signal on to their internal handler,
     * which can be set by anyone to allow handling signals on this socket.
     *
     * Typically the signal-handler of an input-socket will have to be set by it's peer output socket,
     * to allow for signals to travel through in up direction. If one would override that, one is also in charge
     * of signal communication up from input to ouput between these two sockets. Since an output-socket can also
     * peer an output socket, this is also the case for their communication of up signals.
     *
     * Note that the base class of Socket does not cast to the socket owner per-se.
     *
     * This is a detail that is implemeneted by the i/o sockets (and can be opted-in when implementing
     * from abstract socket).
     *
    signal
     */
    cast (signal: Signal): SignalReceiverCastResult {
      if (this.signalHandler_) {
        return this.signalHandler_(signal);
      }
    }

    setSignalHandler (signalHandler: SignalHandler) {
      this.signalHandler_ = signalHandler;
    }

    setOwner (owner: SocketOwner) {
      this.owner = owner;
    }

    getOwner (): SocketOwner {
      return this.owner;
    }
}

export class InputSocket extends Socket {
    private onReceive_: PacketReceiveCallback;

    constructor (onReceive: PacketReceiveCallback, descriptor: SocketDescriptor) {
      super(SocketType.INPUT, descriptor);
      this.onReceive_ = onReceive;
    }

    transfer (p: Packet): boolean {
      this.setTransferring_(true);
      const b = this.onReceive_(p);
      this.setTransferring_(false);
      return b;
    }

    /**
     * Overloads Socket cast method and also casts signal to owner as well as calling
     * super class cast, which call handler.
    s
     */
    cast (s: Signal): SignalReceiverCastResult {
      return collectSignalReceiverCastResults([
        this.owner.cast(s),
        super.cast(s)
      ]);
    }
}

export class OutputSocket extends Socket {
    private peers_: Socket[];

    constructor (descriptor: SocketDescriptor) {
      super(SocketType.OUTPUT, descriptor);
      this.peers_ = [];
    }

    transfer (p: Packet): boolean {
      log(makeLogTimestamped('OutputSocket.transfer packet'));

      let b: boolean;
      this.setTransferring_(true);
      this.peers_.forEach((s) => {
        log('call transfer on peer socket');

        b = s.transfer(p);
        this.onPacketTransferred_(s, b);
      });
      this.setTransferring_(false);
      return b;
    }

    /**
     *
    {Socket} s Socket to whiche this socket transfers data to.
    {OutputSocket} This socket.
     */
    connect (s: Socket) {
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

    disconnect (s: Socket) {
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

    getPeerSockets () {
      return this.peers_;
    }

    /**
     * Cast a signal from this socket.
     *
     * When signal travels down, broadcast to all peer sockets.
     *
     * All other cases (zero or up direction), broadcast to owner.
     *
     * Also calls the super-class implementation and collects results together.
     *
    signal
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
    peerSocket
    signal
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

export abstract class SeekableOutputSocket extends OutputSocket {
    abstract seek(start: number, end?: number): boolean;
}
