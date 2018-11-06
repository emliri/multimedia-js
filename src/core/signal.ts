/**
 * @module
 *
 * Signals allow us to implement an asynchroneous chain-of-resp pattern
 * along the data-path. This should allow to "cast" queries or an acknowledgable information
 * to components up or down the path. The direction of propagation has to be chosen when creating a signal.
 *
 * Signals can be emitted to a group of SignalReceivers. The receivers return a Promise<boolean> which can
 * be resolved or rejected asynchroneously (but must not). A receiver MUST resolve or reject the promise,
 * and also return some valid Promise in the first place (the return value is not nullable).
 *
 * See the SignalReceiver interface and `cast` method.
 *
 * Delegation within receiver implementation can be eased using the SignalHandler type.
 *
 * When casting one signal to many receivers (using the `emit` method) the results of all `cast`
 * calls, the Promise<boolean> aka SignalReceiverCastResult, are collected as an array of results.
 * The results are collected and resolved as all Promises of the receiver group are resolved,
 * and applied an OR logic, meaning if one of the receivers result Promise resolved true, then
 * the result of that cast call will be true. In any other case it will be false.
 *
 * In order to handle failures of components not resolving/rejecting Promises at all,
 * either the components implementing SignalReceiver can wrap their Promise with a timeout,
 * so that they will get automatically rejected. Alternatively, a Signal can be subclassed
 * so that it's emit method, and the subsequent result collector method incorporate such a timeout,
 * and then only aggregate the Promises which have rejected/resolved within that time.
 *
 * The fact a Promise can be resolved/rejected and the result flag (boolean) on the Promise template type
 * allow for exactly four possible "characters" of results to a `cast` call on a receiver. As we will see,
 * this collapses to three effective cases that are meaningful to implement.
 *
 * The idea of a Signal usually is to be able to query something from components within a hiearchical chain,
 * or graph, while trying to make sure that some component in the chain will be able to handle the query
 * or acknowledge the information. When a the result promise gets rejected, we assume that no component CANT
 * handle the signal. When it get's resolved, the respective receiver is assumed that it CAN handle it.
 *
 * Only in the resolve case, the result value (boolean) is actually useful. It indicates, given that
 * a component can handle the signal, wether it actually will do that. This is useful if upon emitting a Signal
 * we want to establish wether for example a resource driver that might respond to the signal "could" actually
 * handle it but is currently busy (result is "false") or wether the resource is not capable or inexistent.
 *
 * For example think of a RTSP receiver that is asked to seek to a position, and is sent a relevant Signal.
 * Of course it will resolve the Promise because it CAN do that in principle. Let's say the receiver just lost
 * it's connection to the server and is unable to re-establish that after several retries. Eventually it will
 * resolve the Promise with `false`.
 *
 * Wether the Signal class itself is actually used as such is completely up the implementation
 * of the SignalReceiver. The class here only defines how the interface is, its async-ness, how the receiver
 * is being called, and how its results are collected and aggregated.
 *
 * The chain-of-resp is in the end formed from the receivers themselves encapsulating references or some sort
 * of loose coupling to each others that defines their hiearchy or graph relationships.
 *
 * When Signal.emit is called, the signal only can know about the first direct group of receivers which
 * are all on the same level.
 *
 * Alike, the cast result does not give any information as to which component(s) have actually resolved
 * the Promise (the results get collected and aggregated anyway). Also note that in principle many
 * components can resolve positively/negatively within one call. Signals are, by default, not a "race",
 * they ideally let every receiver an equal chance (a given timeout for example). However, it is not impossible
 * to implement Signal subclasses which will decide to actually race receivers against each others
 * (and receivers may encapsulate each others in such way when handling signals, or having several internal
 * signal handlers racing).
 *
 * We are not returning references back from the chain-of-resp of the receivers, because a) that would
 * break the encapsulation and loose coupling across receivers, and b) it would actually not be useful
 * for the emitter of the Signals to receive references under the SignalReceiver type anyway.
 *
 */

export enum SignalDirection {
  UP = -1, // should be passed up data direction
  DOWN = +1, // should be passed down data direction
  ZERO = 0 // no propagation
}

export type SignalReceiverCastResult = Promise<boolean>;

export type SignalHandler = (sig: Signal) => SignalReceiverCastResult;

export interface SignalReceiver {
  cast(signal: Signal): SignalReceiverCastResult;
}

export function collectSignalReceiverCastResults (results: SignalReceiverCastResult[]): SignalReceiverCastResult {
  if (results.length === 0) {
    return Promise.resolve(false);
  }
  return Promise.all(results).then((results) => {
    return results.some((res) => res === true);
  });
}

export class Signal {
  constructor (
    private _direction: SignalDirection
  ) {}

  direction (): SignalDirection {
    return this._direction;
  }

  isDirectionUp () {
    return this._direction === SignalDirection.UP;
  }

  isDirectionDown () {
    return this._direction === SignalDirection.DOWN;
  }

  isDirectionZero () {
    return this._direction === SignalDirection.ZERO;
  }

  /**
   * Broadcast method
   */
  emit (receivers: SignalReceiver[]): SignalReceiverCastResult {
    return collectSignalReceiverCastResults(
      receivers.map((receiver: SignalReceiver) => receiver.cast(this))
    );
  }
}
