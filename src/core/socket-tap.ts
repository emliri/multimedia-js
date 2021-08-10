import { Nullable } from '../common-types';
import { mixinWithOptions } from '../lib/options';
import { Packet } from './packet';
/**
 * `pushPacket()`: when return true, gets transferred (directly) by parent socket,
 * when return false, packet ownership can be "kept" by tap (or "dropped" effectively),
 * finally made available via "pop" later (or not).
 * `popPacket()`: will get called when `isClear()` is false - until tap is "cleared"
 * can return any packet in any order
 * `flush()`: should reset clear all internal state
 * @see SocketBase#handleWithTap_
 */
export interface SocketTap {
  pushPacket(p: Packet): boolean;
  popPacket(): Nullable<Packet>;
  isClear(): boolean;
  flush();
}

export class SocketTapDefault implements SocketTap {
  pushPacket (p: Packet): boolean {
    return true;
  }

  popPacket (): Nullable<Packet> {
    return null;
  }

  isClear (): boolean {
    return true;
  }

  flush () {}
}

export class SocketTapQueued extends SocketTapDefault {
  protected _sockTapPushQueue: Packet[] = [];
  protected _sockTapPopQueue: Packet[] = [];

  pushPacket (p: Packet): boolean {
    this._sockTapPushQueue.push(p);
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
}

export function mixinSocketTapDefaultWithOpts<TOptions>(defaultOpts: TOptions){
  return mixinWithOptions<
    typeof SocketTapDefault, TOptions>(SocketTapDefault, defaultOpts);
}

export function mixinSocketTapQueuedWithOpts<TOptions>(defaultOpts: TOptions){
  return mixinWithOptions<
    typeof SocketTapQueued, TOptions>(SocketTapQueued, defaultOpts);
}
