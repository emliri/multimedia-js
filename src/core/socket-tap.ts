import { Nullable } from '../common-types';
import { mixinWithOptions } from '../lib/options';
import { Packet } from './packet';
import { Socket } from './socket';
/**
 * `pushPacket()`: when return true, gets transferred (directly) by parent socket,
 * when return false, packet ownership can be "kept" by tap (or "dropped" effectively),
 * finally made available via "pop" later (or not).
 * `popPacket()`: will get called when `isClear()` is false - until tap is "cleared"
 * can return any packet in any order
 * `flush()`: should reset clear all internal state
 * `pull()`: should signalize request pop`ing further packets,
 *  returns false if cant notify any parent socket (or other) of calling popPacket() on the tap
 * @see SocketBase#handleWithTap_
 */
export interface SocketTap {
  pushPacket(p: Packet): boolean;
  popPacket(): Nullable<Packet>;
  isClear(): boolean;
  flush(): void;
  pull(): boolean;
  setSocket(s: Nullable<Socket>): void;
}

export class SocketTapDefault implements SocketTap {

  private _parentSocket: Nullable<Socket> = null;

  setSocket(s: Nullable<Socket>): void {
    this._parentSocket = s;
  }

  pushPacket (p: Packet): boolean {
    return true;
  }

  popPacket (): Nullable<Packet> {
    return null;
  }

  isClear (): boolean {
    return true;
  }

  pull (): boolean {
    if (!this._parentSocket) return false;
    this._parentSocket.drainTap();
    return true;
  }

  flush () {}
}

// Q: add push/pop byte counters?

export class SocketTapQueued extends SocketTapDefault {
  protected _sockTapPushQueue: Packet[] = [];
  protected _sockTapPopQueue: Packet[] = [];

  protected get pushQueue() {
    return this._sockTapPushQueue;
  }

  protected get popQueue() {
    return this._sockTapPopQueue;
  }

  pushPacket (p: Packet): boolean {
    this._sockTapPushQueue.push(p);
    // todo: optionally run this on next tick to actually leverage push-queuing
    this._onQueuePushed();
    return false;
  }

  popPacket (): Nullable<Packet> {
    if (this._sockTapPopQueue.length) return this._sockTapPopQueue.shift();
    return null;
  }

  isClear (): boolean {
    return ! this._sockTapPopQueue.length;
  }

  flush () {
    this._sockTapPushQueue.length = 0;
    this._sockTapPopQueue.length = 0;
  }

  protected _onQueuePushed() {}
}

export function mixinSocketTapDefaultWithOpts<TOptions>(defaultOpts: TOptions) {
  return mixinWithOptions<
    typeof SocketTapDefault, TOptions>(SocketTapDefault, defaultOpts);
}

export function mixinSocketTapQueuedWithOpts<TOptions>(defaultOpts: TOptions) {
  return mixinWithOptions<
    typeof SocketTapQueued, TOptions>(SocketTapQueued, defaultOpts);
}
