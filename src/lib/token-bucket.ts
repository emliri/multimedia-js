import { Nullable } from '../common-types';
import { noop } from '../common-utils';

export interface TokenBucketPacket {
  byteLength: number
}

const CHEAP_CLOCK_PERIOD_MS = 20;

type TokenBucketQDiscConfig = {
  dropProbability: number
}

/**
 *
 * @author Stephan Hesse <stephan@emliri.com>
 *
 * Token-bucket algorithm implementation.
 *
 * Heavily based on litterature found via https://en.wikipedia.org/wiki/Token_bucket
 */
export type TokenBucketPacketPopCb<T> = (packet: TokenBucketPacket, context: Nullable<T>) => void;

export class TokenBucketPacketQueue<T> {
  private _timer: NodeJS.Timeout;
  private _tokens: number;
  private _queue: [TokenBucketPacket, Nullable<T>][] = [];

  /**
   *
   * @param onPacketPop callback on conformity evaluation of a packet
   * @param _tokenRate Rate of tokens i.e Bytes/Second of
   * @param _maxTokens Max number of tokens i.e Size of qdisc buffer in bytes
   * @param _useCheapClock Option to use a "cheap clock", needs less resource,
   * (token addition is aggregated over a coarse-grain window) but less precise!
   */
  constructor (
    public onPacketPop: TokenBucketPacketPopCb<T> = noop,
    private _tokenRate: number = 1,
    private _dropProbability: number = 0,
    private _maxTokens: number = Infinity,
    private _useCheapClock: boolean = true
  ) {
    if (this._dropProbability > 1 || this._dropProbability < 0) {
      throw new Error('Drop-probability should be between 0 and 1');
    }

    this.reset();
  }

  /**
   * @property {number} rate the rate at which "tokens" are added in bytes/second.
   * Number MUST be integer (use `setAvgRateInBitsPerSec` as a rounding wrapper).
   * This exactly corresponds to the average byte-rate at which the bucket will allow packets to conform with.
   *
   */
  set tokenRate (byteRate: number) {
    this._tokenRate = byteRate;
    this._scheduleTokenRate();
  }

  get tokenRate (): number {
    return this._tokenRate;
  }

  /**
   * Number SHOULD be integer
   * @property {number}
   */
  set maxTokens (max: number) {
    this._maxTokens = max;
  }

  get maxTokens (): number {
    return this._maxTokens;
  }

  reset () {
    this._tokens = 0;
    this._scheduleTokenRate();
    this._queue.length = 0;
  }

  pushPacket (packet: TokenBucketPacket, context: T = null) {
    this._queue.push([packet, context]);

    this._processQueue();
  }

  configureQueueDiscipline (qdiscConfig: TokenBucketQDiscConfig = null): TokenBucketQDiscConfig {
    if (qdiscConfig) {
      this._dropProbability = qdiscConfig.dropProbability;
    }
    return {
      dropProbability: this._dropProbability
    };
  }

  /**
   * Sets the `tokenRate` property by calculating
   * the correspondongh byte-rate and rounding to next integer number
   * @param bps bits/second
   */
  setAvgRateInBitsPerSec (bps: number) {
    this.tokenRate = Math.round(bps / 8);
  }

  /**
   *
   * @param maxRate bytes/second
   * @returns bytes
   */
  getMaxBurstTime (maxRate: number): number {
    if (this._tokenRate < maxRate) {
      return this._maxTokens / (maxRate - this._tokenRate);
    } else {
      return Infinity;
    }
  }

  /**
   *
   * @param maxRate bytes/second
   * @returns bytes
   */
  getMaxBurstSize (maxRate: number): number {
    return maxRate * this.getMaxBurstTime(maxRate);
  }

  private _onTimer () {
    if (this._tokens >= this._maxTokens) {
      return;
    }

    if (this._useCheapClock) {
      this._tokens += Math.floor(this._tokenRate * CHEAP_CLOCK_PERIOD_MS / 1000);
    } else {
      this._tokens++;
    }

    this._processQueue();
  }

  private _scheduleTokenRate () {
    if (!Number.isInteger(this._tokenRate)) {
      throw new Error('Token rate has to be integer');
    }

    clearInterval(this._timer);
    if (this._useCheapClock) {
      this._timer = setInterval(this._onTimer.bind(this), CHEAP_CLOCK_PERIOD_MS);
    } else {
      this._timer = setInterval(this._onTimer.bind(this), Math.round(1000 * (1 / this._tokenRate)));
    }
  }

  private _processQueue () {
    if (this._queue.length === 0) {
      return;
    }

    const [packet, context] = this._queue[0];

    if (this._tokens >= packet.byteLength) {
      this._queue.shift();
      this._tokens -= packet.byteLength;
      this.onPacketPop && this.onPacketPop(packet, context || null);
    } else { // packet is non-conformant
      if (this._dropProbability > 0 && (Math.random() <= this._dropProbability)) { // drop packet
        this._queue.shift();
      }
    }
  }
}
