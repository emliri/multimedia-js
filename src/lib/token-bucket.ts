import { Nullable } from '../common-types';
import { millisToSecs, noop, secsToMillis } from '../common-utils';

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
 * Heavily based on literature found via https://en.wikipedia.org/wiki/Token_bucket
 */
export type TokenBucketPacketPopCb<T> = (packet: TokenBucketPacket, context: Nullable<T>) => void;

export class TokenBucketPacketQueue<T> {
  private _timer: unknown;
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
    private _tokenRate: number = Infinity,
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
   * @property {number} tokenRate rate at which "tokens" are added in 1/second.
   * Number SHOULD be integer (or Infinity). Non-integer will lead to rounding either-way.
   *
   * This exactly corresponds to the average byte-rate
   * at which the bucket will allow packets to conform with.
   */
  set tokenRate (tokenRate: number) {
    if (tokenRate < 0) {
      throw new Error('Token-rate set can not be negative: ' + tokenRate);
    }
    this._tokenRate = tokenRate;
    this._scheduleTokenRate();
  }

  get tokenRate (): number {
    return this._tokenRate;
  }

  /**
   * Number SHOULD be integer (otherwise doesn't make much sense) or Infinity.
   * Has no effect if token-rate is set to Infinity (TODO: should it?).
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
   * the corresponding byte-rate and rounding to next integer number
   * @param bps bits/second
   */
  setAvgBitrate (bps: number) {
    this.tokenRate = Math.round(bps / 8);
  }

  setMaxBurstRate (maxBurstRate: number, expectedBurstTSecs: number) {
    if (this._tokenRate >= maxBurstRate) {
      throw new Error('Desired max-burst-rate has to be greater than token-rate set');
    }
    this._maxTokens = (maxBurstRate - this._tokenRate) * expectedBurstTSecs;
  }

  /**
   *
   * @param expectedMaxBurstRate bytes/second
   * @returns bytes
   */
  getMaxBurstTime (expectedMaxBurstRate: number): number {
    if (this._tokenRate >= expectedMaxBurstRate) {
      throw new Error('Expected max-burst-rate has to be greater than token-rate set');
    }
    return this._maxTokens / (expectedMaxBurstRate - this._tokenRate);
  }

  /**
   *
   * @param expectedMaxBurstRate bytes/second
   * @returns bytes
   */
  getMaxBurstSize (expectedMaxBurstRate: number): number {
    return expectedMaxBurstRate * this.getMaxBurstTime(expectedMaxBurstRate);
  }

  private _onTimer () {
    if (this._tokens < this._maxTokens) {
      if (this._useCheapClock) {
        this._tokens += Math.floor(this._tokenRate * millisToSecs(CHEAP_CLOCK_PERIOD_MS));
      } else {
        this._tokens++;
      }
    }
    this._processQueue();
  }

  private _scheduleTokenRate () {
    clearInterval(this._timer as number);

    if (this._tokenRate === Infinity) {
      this._tokens = Infinity;
      return;
    } else if (this._tokens === Infinity) {
      // reset state to something incrementable
      // if we come out unlimited mode
      this._tokens = 0;
    }

    if (this._useCheapClock) {
      // todo: fallback to per-token increment timer when
      // this._tokenRate * CHEAP_CLOCK_PERIOD_MS / 1000 < 1
      // e.g rate < 50 B/s @ 20ms clock period
      this._timer = setInterval(this._onTimer.bind(this), CHEAP_CLOCK_PERIOD_MS);
    } else {
      // todo: select cheap clock when getting to unrealistic timer scheduling
      // high rates, i.e when 1000 / this._tokenRate < 1
      // e.g rate > 1000 B/s
      this._timer = setInterval(this._onTimer.bind(this), Math.round(secsToMillis(1 / this._tokenRate)));
    }

    // we process queue after any reschedule immediately
    // to resync rate as quickly as possible
    // (and to effectively flush in case was set rate to infinity)
    this._processQueue();
  }

  private _processQueue () {
    if (this._queue.length === 0) {
      return;
    }

    const [packet, context] = this._queue[0];

    if (this._tokens >= packet.byteLength ||
      // this second condition is handling a corner-case,
      // as some packets/transports "MTU" themselves may be just larger
      // then any window set (for example when reading from
      // a local loopback HTTP/TCP connection, read-buffers can
      // be potentially much larger than what we would like
      // set here as burst max-window...).
      // The token-counter will either-way be decremented (resulting negative obviously)
      // with this packet being passed as compliant,
      // and thus for any next packet it will require "refill"
      // such that all-in-all there is no harm at the rate-limit compliance overall
      // or in the validity of the solution generally.
      this._maxTokens <= packet.byteLength) {
      this._queue.shift();
      this._tokens -= packet.byteLength;
      this.onPacketPop && this.onPacketPop(packet, context || null);
      // if we have popped a packet we run another process call
      // in case the next packet is conformant as well.
      // otherwise the output rate would not be accurate,
      // since queue is otherwise processed only
      // on next token-increment scheduled tick
      // or via pushing new packet.
      this._processQueue();
    } else { // packet is non-conformant
      if (this._dropProbability > 0 && (Math.random() <= this._dropProbability)) { // drop packet
        this._queue.shift();
      }
    }
  }
}
