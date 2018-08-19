import { Processor } from "./processor";
import { Socket } from "./socket";

export enum FlowState {
  VOID = 'void',
  WAITING = 'waiting',
  FLOWING = 'flowing'
};

export type FlowStateChangeCallback = (previousState: FlowState, newState: FlowState) => void;

// TODO: create generic set class in objec-ts
export abstract class Flow {

  constructor(
    public onStateChangePerformed: FlowStateChangeCallback,
    public onStateChangeAborted: (reason: string) => void
  ) {}

  private _processors: Set<Processor> = new Set();
  private _state: FlowState = FlowState.VOID;
  private _pendingState: FlowState | null = null;
  private _prevState: FlowState | null = null;

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

  set state(newState: FlowState) {

    if (this._pendingState) {
      throw new Error('Flow state-change still pending: ' + this._pendingState);
    }

    const cb: FlowStateChangeCallback = this.onStateChangePerformed_.bind(this);

    const currentState = this._state;
    switch (currentState) {
    case FlowState.VOID:
      if (newState !== FlowState.WAITING) {
        fail();
      }
      this.onVoidToWaiting_(cb);
      break;
    case FlowState.WAITING:
      if (newState === FlowState.FLOWING) {
        this._pendingState = newState;
        this.onWaitingToFlowing_(cb);
      } else if (newState === FlowState.VOID) {
        this._pendingState = newState;
        this.onWaitingToVoid_(cb);
      } else {
        fail();
      }
      break;
    case FlowState.FLOWING:
      if (newState !== FlowState.WAITING) {
        fail();
      }
      this._pendingState = newState;
      this.onFlowingToWaiting_(cb);
      break;
    }

    function fail() {
      throw new Error(`Can not transition from flow state ${currentState} to ${newState}`);
    }
  }

  get state(): FlowState {
    return this._state;
  }

  getPendingState(): FlowState | null {
    return this._pendingState;
  }

  getPreviousState(): FlowState | null {
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

  protected abstract onVoidToWaiting_(cb: FlowStateChangeCallback);
  protected abstract onWaitingToVoid_(cb: FlowStateChangeCallback);
  protected abstract onWaitingToFlowing_(cb: FlowStateChangeCallback);
  protected abstract onFlowingToWaiting_(cb: FlowStateChangeCallback);
  protected abstract onStateChangeAborted_(reason: string);
}
