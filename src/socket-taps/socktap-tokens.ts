import { Nullable } from '../common-types';
import { Packet } from '../core/packet';
import { SocketTapDefault } from '../core/socket-tap';
import { TokenBucketPacketQueue } from '../lib/token-bucket';
import { TokenRate } from '../lib/token-rate';

export class SocketTapTokenBucket extends SocketTapDefault {
  private _tokenBucket: TokenBucketPacketQueue<Packet>;
  private _tokenRateIn = new TokenRate(this._rateDeltaMs);
  private _tokenRateOut = new TokenRate(this._rateDeltaMs);
  private _packetQ: Packet[] = [];

  constructor (private _rateDeltaMs: number = 1000) {
    super();
    this._tokenBucket = new TokenBucketPacketQueue((p_, p) => {
      this._onTokBucketPop(p);
    });
  }

  set byteRateLimit (rate: number) {
    this._tokenBucket.tokenRate = Math.ceil(rate);
  }

  get byteRateLimit (): number {
    return this._tokenBucket.tokenRate;
  }

  get byteRateIn () {
    return this._tokenRateIn.value();
  }

  get byteRateOut () {
    return this._tokenRateOut.value();
  }

  getTokenBucket (): TokenBucketPacketQueue<Packet> {
    return this._tokenBucket;
  }

  pushPacket (p: Packet): boolean {
    this._tokenBucket.pushPacket(p, p);
    this._tokenRateIn.add(p.byteLength);
    return false;
  }

  popPacket (): Nullable<Packet> {
    const p = this._packetQ.shift() || null;
    if (p) {
      this._tokenRateOut.add(p.byteLength);
    }
    return p;
  }

  isClear () {
    return this._packetQ.length === 0;
  }

  flush () {
    this._packetQ.length = 0;
    this._tokenBucket.tokenRate = Infinity;
    this._tokenBucket.reset();
  }

  private _onTokBucketPop (p: Packet) {
    this._packetQ.push(p);
  }
}
