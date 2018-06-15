import { Processor } from "./processor";
import { Socket } from "./socket";

export enum TubingState {
  VOID = 'void',
  WAITING = 'waiting',
  FLOWING = 'flowing'
};

export type TubingStateChangeCallback = (previousState: TubingState, newState: TubingState) => void;

// TODO: create generic set class in objec-ts
export abstract class Tubing {

  constructor(
    public onStateChangePerformed: TubingStateChangeCallback,
    public onStateChangeAborted: (reason: string) => void
  ) {}

  private _processors: Set<Processor> = new Set();
  private _state: TubingState = TubingState.VOID;
  private _pendingState: TubingState | null = null;
  private _prevState: TubingState | null = null;

  add(...p: Processor[]) {
    p.forEach((proc) => {
      this._processors.add(proc);
    })
  }

  remove(...p: Processor[]) {
    p.forEach((proc) => {
      if (!this._processors.delete(proc)) {
        throw new Error('Set delete method returned false');
      }
    })
  }

  get procList(): Processor[] {
    return Array.from(this._processors);
  }

  get extSockets(): Socket[] {
    return Array.from(this.getExternalSockets());
  }

  set state(newState: TubingState) {

    if (this._pendingState) {
      throw new Error('TubingState-change still pending: ' + this._pendingState);
    }

    const cb: TubingStateChangeCallback = this.onStateChangePerformed_.bind(this);

    const currentState = this._state;
    switch (currentState) {
    case TubingState.VOID:
      if (newState !== TubingState.WAITING) {
        fail();
      }
      this.onVoidToWaiting_(cb);
      break;
    case TubingState.WAITING:
      if (newState === TubingState.FLOWING) {
        this._pendingState = newState;
        this.onWaitingToFlowing_(cb);
      } else if (newState === TubingState.VOID) {
        this._pendingState = newState;
        this.onWaitingToVoid_(cb);
      } else {
        fail();
      }
      break;
    case TubingState.FLOWING:
      if (newState !== TubingState.WAITING) {
        fail();
      }
      this._pendingState = newState;
      this.onFlowingToWaiting_(cb);
      break;
    }

    function fail() {
      throw new Error(`Can not transition from tubing state ${currentState} to ${newState}`);
    }
  }

  get state(): TubingState {
    return this._state;
  }

  getPendingState(): TubingState | null {
    return this._pendingState;
  }

  getPreviousState(): TubingState | null {
    return this._prevState;
  }

  abortPendingStateChange(reason: string) {
    this.onStateChangeAborted_(reason);
    this._pendingState = null;
    this.onStateChangeAborted(reason);
  }

  getExternalSockets(): Set<Socket> {
    return new Set();
  }

  private onStateChangePerformed_(newState) {
    this._prevState = this._state;
    this._state = newState;
    this._pendingState = null;
    this.onStateChangePerformed(this._prevState, this._state);
  }

  protected abstract onVoidToWaiting_(cb: TubingStateChangeCallback);
  protected abstract onWaitingToVoid_(cb: TubingStateChangeCallback);
  protected abstract onWaitingToFlowing_(cb: TubingStateChangeCallback);
  protected abstract onFlowingToWaiting_(cb: TubingStateChangeCallback);
  protected abstract onStateChangeAborted_(reason: string);
}
