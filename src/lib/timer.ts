
import { LambdaFunc, VoidCallback } from '../common-types';
import { getPerfNow, getPerfWallClockTime } from '../perf-ctx';

// export function clearAllTimers()

export function setOnceTimer (func: VoidCallback, timeoutMs: number = 0): number {
  return <any> setTimeout(func, timeoutMs);
}

export function cancelOnceTimer (id: number): void {
  clearTimeout(id);
}

export function setRepeatTimer (func: VoidCallback, timeoutMs: number = 0): number {
  return <any> setInterval(func, timeoutMs);
}

export function cancelRepeatTimer (id: number): void {
  clearInterval(id);
}

export function delay<T> (result: T, timeoutMs: number = 0): Promise<T> {
  return new Promise((resolve) => {
    setOnceTimer(() => {
      resolve(result);
    }, timeoutMs);
  });
}

export function defer<T> (result: LambdaFunc<T>, timeoutMs: number = 0): Promise<T> {
  return new Promise((resolve) => {
    setOnceTimer(() => {
      resolve(result());
    }, timeoutMs);
  });
}

export async function sleepLoop (func: () => boolean, sleepMs: number = 0) {
  let nextSleepMs = sleepMs;
  while (true) {
    const now = getPerfNow();
    const result = await defer(func, nextSleepMs);
    if (result) break;
    const awaitMs = getPerfNow() - now;
    nextSleepMs = sleepMs - Math.max(0, awaitMs - sleepMs);
  }
}

export enum TimerMode {
  ONCE,
  REPEAT
}

export enum TimerState {
  PENDING,
  RUNNING,
  ERROR,
  CANCELED,
  DONE,
  VOID,
}

export class Timer {
  private _id;
  private _state = TimerState.VOID;
  private _expectedAt: number = NaN;
  private _scheduleDeltaMs: number = NaN;

  static Once (func: VoidCallback, timeoutMs: number): Timer {
    return new Timer(func, timeoutMs, TimerMode.ONCE).on();
  }

  static Repeat (func: VoidCallback, timeoutMs: number): Timer {
    return new Timer(func, timeoutMs, TimerMode.REPEAT).on();
  }

  constructor (private _func: VoidCallback,
    private _timeoutMs: number, private _mode: TimerMode = TimerMode.ONCE) {
  }

  get mode (): TimerMode {
    return this._mode;
  }

  get state (): TimerState {
    return this._state;
  }

  get expectedAt (): number {
    return this._expectedAt;
  }

  get scheduleDelta (): number {
    return this._scheduleDeltaMs;
  }

  /*
  get hasRun(): Promise {

  }
  */

  /**
   * Null refs to callback functions (also onError)
   * in order to avoid mem-leaks.
   * Calls off() first. Sets state to VOID finally.
   */
  clear () {
    this.off();
    this._func = null;
    this.onError = null;
    this._state = TimerState.VOID;
  }

  isCleared (): boolean {
    return !this._func;
  }

  setFunction (func: VoidCallback) {
    this._func = func;
  }

  isScheduled (): boolean {
    // includes running/error states,
    // in case of repeat mode
    // the timer is still "pending" then,
    // as it will go back into this state
    // by default after each _run call.
    return this._state < TimerState.CANCELED;
  }

  onError (err: Error) {} // eslint-disable-line node/handle-callback-err

  on () {
    if (this.isCleared()) {
      throw new Error('Timer instance is destroyed, cant call on()');
    }
    this.off();
    this._state = TimerState.PENDING;
    switch (this._mode) {
    case TimerMode.ONCE:
      this._id = setOnceTimer(this._run.bind(this), this._timeoutMs);
      break;
    case TimerMode.REPEAT:
      this._id = setRepeatTimer(this._run.bind(this), this._timeoutMs);
      break;
    }
    this._expectedAt = getPerfWallClockTime() + this._timeoutMs;
    return this;
  }

  off (): boolean {
    if (!this.isScheduled()) {
      return false;
    }
    this._expectedAt = NaN;
    this._scheduleDeltaMs = NaN;
    this._state = TimerState.CANCELED;
    switch (this._mode) {
    case TimerMode.ONCE:
      cancelOnceTimer(this._id);
      break;
    case TimerMode.REPEAT:
      cancelRepeatTimer(this._id);
      break;
    }
    return true;
  }

  private _run () {
    const now = getPerfWallClockTime();
    this._scheduleDeltaMs = now - this._expectedAt;
    if (this._mode === TimerMode.REPEAT) {
      this._expectedAt = now + this._timeoutMs;
    } else {
      this._expectedAt = NaN;
    }
    this._state = TimerState.RUNNING;
    try {
      this._func();
    } catch (err) {
      this._state = TimerState.ERROR;
      this.onError(err);
      // callback may have changed state,
      // only finalize if no custom handling
      // (which is the current purpose of explicit error state).
      if (this._state === TimerState.ERROR) {
        finalize();
      }
      // also, throw error now (this will jump over finally block),
      // so that it can be handled how it should by usage side
      // (we shouldn't suppress the error, only allow timer-lifecycle management
      // over it).
      throw err;
    } finally {
      finalize();
    }

    function finalize () {
      if (this._mode === TimerMode.REPEAT) {
        this._state = TimerState.PENDING;
      } else {
        this._state = TimerState.DONE;
      }
    }
  }
}
