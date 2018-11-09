import { PayloadDescriptor } from './payload-description';
import { Packet, PacketReceiveCallback } from './packet';

import { getLogger, makeLogTimestamped, LoggerLevels } from '../logger';
import { Signal, SignalHandler, SignalReceiver, SignalReceiverCastResult, collectSignalReceiverCastResults } from './signal';

import { dispatchAsyncTask } from '../common-utils';

const { log, error } = getLogger('Socket', LoggerLevels.OFF);

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

export type SocketTemplateGenerator = (st: SocketType) => SocketDescriptor;

export class SocketDescriptor {
  static fromMimeType(mimeType: string): SocketDescriptor {
    return SocketDescriptor.fromMimeTypes(mimeType);
  }

  static fromMimeTypes(...mimeTypes: string[]): SocketDescriptor {
    return new SocketDescriptor(mimeTypes.map((mimeType) => new PayloadDescriptor(mimeType)));
  }

  // TODO: also allow to directly bind this to proc templateSocketDescriptor method on construction
  static createTemplateGenerator(
    inputSd: SocketDescriptor, outputSd: SocketDescriptor): SocketTemplateGenerator {
    return ((st: SocketType) => {
      switch(st) {
      case SocketType.INPUT: return inputSd;
      case SocketType.OUTPUT: return outputSd;
      }
    });
  }

  readonly payloads: PayloadDescriptor[];

  constructor (payloads?: PayloadDescriptor[]) {
    this.payloads = payloads || [];
  }

  isVoid(): boolean {
    return this.payloads.length === 0;
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
  private isReady_: boolean = false;
  private isReadyArmed_: boolean = false;
  private resolveDisposed_;

  protected owner: SocketOwner = null;

  constructor (type: SocketType, descriptor: SocketDescriptor) {
    this.type_ = type;
    this.descriptor_ = descriptor;
    this.state_ = new SocketState();
  }

  dispose() {}

  type (): SocketType {
    return this.type_;
  }

  payload(index: number = 0): PayloadDescriptor {
    return this.descriptor_.payloads[index];
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
   * A utility method to manage the readyness state synchroneously.
   * For every socket-instance we are then retrieving the whenReady promise
   * *once* and tracking the ready-state through it.
   */
  isReady(): boolean {
    if (!this.isReadyArmed_) {
      this.whenReady().then(() => {
        this.isReady_ = true;
      }).catch((e: Error) => {
        error('caught error on readyness-promise:', e);
      });
      this.isReadyArmed_ = true;
    }
    return this.isReady_;
  }

  /**
   * MAY be implemented by subclasses to indicate async I/O resource initialization readyness
   * when applicable (for example for file-system or MediaSource socket).
   *
   * The default implementation works for any socket impl that is ready "in-sync" with the constructor
   * as it returns an already resolve promise.
   *
   * Further specification constraints:
   *
   * 1) When the readyness-promise hasn't been resolved yet, the socket MAY crash
   * when it gets transferred data or signals cast.
   *
   * 2) The socket MUST be connectable upon creation however.
   * Ideally, a pipeline (or the respective branch) should first make sure that all it's I/O sockets are
   * "ready" before enabling any data-flow.
   *
   * 3) Socket implemention SHOULD never buffer/queue-up any data in the integration layer,
   * as it is a task that processors are more suited to do and that is independent of socket.
   *
   * 4) Queuing data in proc while downstream sockets become ready MAY be the best solution in certain
   * cases of pipeline restructering.
   *
   * 5) I/O "reading" output-sockets MAY become ready async and not cause further harm by not implementing `whenReady` method.
   *
   * 6) A socket MUST never go back to something "not ready" when it was ready once.
   *
   * FIXME: implement "dispose" method
   *
   */
  whenReady(): Promise<void> {
    return Promise.resolve();
  }

  /*
  whenDisposed(): Promise<void> {
    return Promise.resolve();
  }
  */

  /**
   * For subclasses only. Set the transfering flag of the socket state.
   */
  protected setTransferring_ (b: boolean) {
    this.state_.transferring = b;
  }

  /**
   * Wraps transferSync in an async call and returns a promise
   * @param p
   */
  transfer (p: Packet): Promise<boolean> {
    return new Promise((resolve, reject) => {
      dispatchAsyncTask(() => {
        try {
          resolve(this.transferSync(p));
        } catch(e) {
          reject(e);
        }
      });
    });
  }

  /**
   * Transfer the partial ownership of a Packet to this Socket.
   *
   * Implemented by the subclass in a "sync" manner.
   *
   * Return `false` value may indicate that the socket is not peered
   * and thus no effective transfer took place, or that the data processing handler
   * is not set in some other way, or an error was thrown when processing.
   */
  abstract transferSync(p: Packet): boolean;

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

  static unsafe(s: Socket): InputSocket {
    return (<InputSocket> s);
  }

  private onReceive_: PacketReceiveCallback;

  constructor (onReceive: PacketReceiveCallback, descriptor: SocketDescriptor) {
    super(SocketType.INPUT, descriptor);
    this.onReceive_ = onReceive;
  }

  transferSync (p: Packet): boolean {
    this.setTransferring_(true);
    const b = this.onReceive_(p);
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
}

export class OutputSocket extends Socket {

  static unsafe(s: Socket): OutputSocket {
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

export abstract class SeekableOutputSocket extends OutputSocket {
  abstract seek(start: number, end?: number): boolean;
}
