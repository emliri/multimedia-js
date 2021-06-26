import { Packet } from '../core/packet';
import { SocketTapDefault } from '../core/socket-tap';
import { TokenBucketPacketQueue } from '../lib/token-bucket';

export class SocketTapTokenRate extends SocketTapDefault {
  private _tokenBucket = new TokenBucketPacketQueue<Packet>();

  pushPacket (p: Packet): boolean {
    this._tokenBucket.pushPacket(p, p);
    return true;
  }
}
