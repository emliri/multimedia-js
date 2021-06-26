import { Nullable } from '../common-types';
import { Packet } from './packet';
import { PacketDataModel } from './packet-model';

/**
 * pushPacket: when return false, packet vanishes, when true, get transferred
 * popPacket: will get called when isClear is false until tap is "cleared"
 * flush: should drop all internal state
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
