import { EventEmitter } from 'eventemitter3';

import { PayloadDescriptor } from './payload-description';
import { Packet, PacketReceiveCallback, PacketSymbol } from './packet';

import { getLogger, makeLogTimestamped, LoggerLevel } from '../logger';
import { Signal, SignalHandler, SignalReceiver, SignalReceiverCastResult, collectSignalReceiverCastResults } from './signal';

import { dispatchAsyncTask } from '../common-utils';
import { OutputSocket } from './socket-output';

const { log, error } = getLogger('Socket', LoggerLevel.ERROR);

export enum SocketType {
  INPUT,
  OUTPUT
}

export enum SocketEvent {
  ANY_PACKET_TRANSFERRED = 'any-packet-transferred',
  EOS_PACKET_TRANSFERRED = 'eos-packet-transferred',
  ANY_PACKET_RECEIVED = 'any-packet-received',
  DATA_PACKET_RECEIVED = 'data-packet-received', // "non-symbolic"
  EOS_PACKET_RECEIVED = 'eos-packet-received'
}

export type SocketEventHandler = (event: SocketEvent) => void

export class SocketState {
  transferring: boolean;

  constructor () {
    this.transferring = false;
  }
}

export type SocketTemplateGenerator = (st: SocketType) => SocketDescriptor;

export class SocketDescriptor {
  static fromMimeType (mimeType: string): SocketDescriptor {
    return SocketDescriptor.fromMimeTypes(mimeType);
  }

  static fromMimeTypes (...mimeTypes: string[]): SocketDescriptor {
    return new SocketDescriptor(mimeTypes.map((mimeType) => new PayloadDescriptor(mimeType)));
  }

  static fromPayloads (payloads: PayloadDescriptor[]): SocketDescriptor {
    return new SocketDescriptor(payloads);
  }

  static fromJson(serializedSd: string): SocketDescriptor {
    const sd: SocketDescriptor = JSON.parse(serializedSd);
    // now lets brings this dead thing back to life
    return SocketDescriptor.fromPayloads(
      sd.payloads.map((payload) => {
        const pd = new PayloadDescriptor(
          payload.mimeType,
          payload.sampleRateInteger,
          payload.sampleDepth,
          payload.sampleDurationNumerator
        );
        pd.details = payload.details;
        return pd;
      })
    )
  }

  // TODO: also allow to directly bind this to proc templateSocketDescriptor method on construction
  static createTemplateGenerator (
    inputSd: SocketDescriptor, outputSd: SocketDescriptor): SocketTemplateGenerator {
    return (st: SocketType) => {
      switch (st) {
      case SocketType.INPUT: return inputSd;
      case SocketType.OUTPUT: return outputSd;
      }
    };
  }

  readonly payloads: PayloadDescriptor[];

  payload(): PayloadDescriptor {
    if (this.payloads.length > 1) {
      throw new Error('Socket descriptor has more than on payload descriptor');
    }
    if (this.payloads.length === 0) {
      throw new Error('Socket descriptor has no payload descriptors');
    }
    return this.payloads[0];
  }

  constructor (payloads?: PayloadDescriptor[]) {
    this.payloads = payloads || [];
  }

  isVoid (): boolean {
    return this.payloads.length === 0;
  }

  toJson(): string {
    try {
      return JSON.stringify(this);
    } catch (err) {
      throw new Error('Could not serialize socket descriptor. JSON error: ' + err.messsage);
    }
  }
}

export abstract class SocketOwner implements SignalReceiver {
  abstract getOwnSockets(): Set<Socket>;
  abstract cast(signal: Signal): SignalReceiverCastResult;
}

export abstract class Socket extends EventEmitter<SocketEvent> implements SignalReceiver {
  private type_: SocketType;
  private state_: SocketState;
  private descriptor_: SocketDescriptor;
  private signalHandler_: SignalHandler = null;
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

  close () {}

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
          this._emit(SocketEvent.ANY_PACKET_TRANSFERRED);
          if (p.isSymbolic()) {
            switch(p.symbol) {
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

  setOwner (owner: SocketOwner) {
    this.owner = owner;
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

export abstract class SeekableOutputSocket extends OutputSocket {
  abstract seek(start: number, end?: number): boolean;
}

export { OutputSocket } from './socket-output';
export { InputSocket } from './socket-input';
