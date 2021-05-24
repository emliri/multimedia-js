import { EventEmitter } from 'eventemitter3';

import { SocketEvent, SocketState, SocketDescriptor, SocketOwner, SocketEventHandler, SocketType } from './socket';
import { SignalReceiver, SignalHandler, Signal, SignalReceiverCastResult } from './signal';
import { PayloadDescriptor } from './payload-description';
import { Packet } from './packet';
import { PacketSymbol } from './packet-symbol';
import { SocketTap } from './socket-tap';

import { dispatchAsyncTask } from '../common-utils';
import { getLogger, LoggerLevel } from '../logger';
import { Nullable } from '../common-types';

const { log, error } = getLogger('SocketBase', LoggerLevel.ERROR);

export abstract class Socket extends EventEmitter<SocketEvent> implements SignalReceiver {
  private type_: SocketType;
  private state_: SocketState;
  private descriptor_: SocketDescriptor;
  private signalHandler_: Nullable<SignalHandler> = null;
  private tap_: Nullable<SocketTap> = null;

  private isReady_: boolean = false;
  private isReadyArmed_: boolean = false;
  private resolveDisposed_;

  protected owner: SocketOwner = null;

  constructor (type: SocketType, descriptor: SocketDescriptor) {
    super();
    this.type_ = type;
    this.descriptor_ = descriptor;
    this.state_ = new SocketState();
  }

  close () {
    this.state_.closed = true;
  }

  type (): SocketType {
    return this.type_;
  }

  descriptor (): SocketDescriptor {
    return this.descriptor_;
  }

  payload (index: number = 0): PayloadDescriptor {
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
  isReady (): boolean {
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
  whenReady (): Promise<void> {
    return Promise.resolve();
  }

  /*
  whenDisposed(): Promise<void> {
    return Promise.resolve();
  }
  */

  protected handleWithTap_ (tap: SocketTap, p: Packet): Nullable<Packet> {
    while(!tap.isClear()) {
      const _p = tap.popPacket();
      if (!_p) throw new Error('SocketTap implementation failure: popPacket expected to return non-null since isClear was false');
      this.transferAsync_(_p);
    }
    if (this.tap_
      // if the Tap returns false,
      // it "keeps" the packet on its stack
      && !this.tap_.pushPacket(p)) {
      return null;
    }
    return p;
  }

  /**
   * For subclasses only. Set the transfering flag of the socket state.
   */
  protected setTransferring_ (b: boolean) {
    this.state_.transferring = b;
  }

  private transferAsync_ (p: Packet): Promise<boolean> {
    return new Promise((resolve, reject) => {
      dispatchAsyncTask(() => {
        try {
          resolve(this.transferSync(p));
          this._emit(SocketEvent.ANY_PACKET_TRANSFERRED);
          if (p.isSymbolic()) {
            switch (p.symbol) {
            case PacketSymbol.EOS:
              this._emit(SocketEvent.EOS_PACKET_TRANSFERRED);
              break;
            default:
              break;
            }
          }
        } catch (e) {
          error('Error upon packet-transfer execution:', e);
          reject(e);
        }
      });
    });
  }

  /**
   * Wraps transferSync in an async call and returns a promise
   * @param p
   */
  transfer (p: Packet): Promise<boolean> {
    if (this.tap_) {
      p = this.handleWithTap_(this.tap_, p);
      if (!p) return Promise.resolve(true);
    }
    return this.transferAsync_(p);
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
   * The default implementation is a synchroneous call,
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

  setTap (tap: SocketTap): Socket {
    this.tap_ = tap;
    return this;
  }

  getTap(): SocketTap {
    return this.tap_;
  }

  setOwner (owner: SocketOwner): Socket {
    this.owner = owner;
    return this;
  }

  getOwner (): SocketOwner {
    return this.owner;
  }

  emit (e: SocketEvent): boolean {
    throw new Error('Illegal call');
  }

  on (event: SocketEvent, handler: SocketEventHandler) {
    super.on(event, handler);
    return this;
  }

  once (event: SocketEvent, handler: SocketEventHandler) {
    super.once(event, handler);
    return this;
  }

  off (event: SocketEvent, handler: SocketEventHandler) {
    super.off(event, handler);
    return this;
  }

  protected _emit (event: SocketEvent) {
    super.emit(event, event);
  }
}
