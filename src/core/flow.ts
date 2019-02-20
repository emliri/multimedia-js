import { Processor } from './processor';
import { Socket } from './socket';
import { ErrorInfo } from './error';
import { VoidCallback } from '../common-types';
import { EventEmitter } from 'eventemitter3';

export enum FlowState {
  VOID = 'void', // the initial state
  WAITING = 'waiting', // there must be one packet arrived at each terminating external output
                       // socket to reach this state, and then no more data gets transferred
  FLOWING = 'flowing', // this is when data is freely flowing through all procs
  COMPLETED = 'completed' // this is when all external input socket data is consumed
                          // or otherwise not available anymore, and the last EOS has reached the terminating output sockets
}

export enum FlowCompletionResultCode {
  NONE = 'none',
  OK = 'ok',
  FAILED = 'failed'
}

export type FlowCompletionResult = {
  code: FlowCompletionResultCode
  data: Blob
}

export enum FlowErrorType {
  CORE = 'core',
  PROC = 'proc',
  RUNTIME = 'runtime'
}

export type FlowError = ErrorInfo & {
  type: FlowErrorType
}

export enum FlowEvent {
  STATE_CHANGE_PENDING = 'flow:state-change-pending',
  STATE_CHANGE_ABORTED = 'flow:state-change-aborted',
  STATE_CHANGED = 'flow:state-changed'
}

export type FlowStateChangeCallback = (previousState: FlowState, newState: FlowState) => void;

// TODO: create generic Set class in objec-ts
export abstract class Flow extends EventEmitter<FlowEvent> {

  constructor (
    public onStateChangePerformed: FlowStateChangeCallback,
    public onStateChangeAborted: (reason: string) => void
  ) {

    super();

    this._whenDone = new Promise((resolve, reject) => {
      this._whenDoneResolve = resolve;
      this._whenDoneReject = reject;
    });
  }

  private _state: FlowState = FlowState.VOID;
  private _pendingState: FlowState | null = null;
  private _prevState: FlowState | null = null;

  private _processors: Set<Processor> = new Set();
  private _extSockets: Set<Socket> = new Set();

  private _whenDone: Promise<FlowCompletionResult>;
  private _whenDoneResolve: (value: FlowCompletionResult) => void = null;
  private _whenDoneReject: (reason: FlowError) => void = null;
  private _completionResultCode: FlowCompletionResultCode = FlowCompletionResultCode.NONE;

  get procList (): Processor[] {
    return Array.from(this._processors);
  }

  get externalSockets (): Socket[] {
    return Array.from(this.getExternalSockets());
  }

  add (...p: Processor[]) {
    p.forEach((proc) => {
      this._processors.add(proc);
    });
  }

  remove (...p: Processor[]) {
    p.forEach((proc) => {
      if (!this._processors.delete(proc)) {
        throw new Error('Set delete method returned false');
      }
    });
  }

  whenCompleted(): Promise<FlowCompletionResult> {
    return this._whenDone;
  }

  getCurrentState(): FlowState {
    return this._state;
  }

  getPendingState (): FlowState | null {
    return this._pendingState;
  }

  getPreviousState (): FlowState | null {
    return this._prevState;
  }

  abortPendingStateChange (reason: string) {
    this.onStateChangeAborted_(reason);
    this._pendingState = null;
    this.onStateChangeAborted(reason);

    this.emit(FlowEvent.STATE_CHANGE_ABORTED);
  }

  getExternalSockets (): Set<Socket> {
    return this._extSockets;
  }

  getCompletionResult(): FlowCompletionResultCode {
    return this._completionResultCode;
  }

  set state (newState: FlowState) {
    if (this._pendingState) {
      throw new Error('Flow state-change still pending: ' + this._pendingState);
    }

    if (newState === FlowState.COMPLETED
      && this._completionResultCode === FlowCompletionResultCode.NONE) {
        throw new Error('state change to COMPLETED has to be triggered by setCompleted');
      }

    // update pending state
    this._pendingState = newState;
    this.emit(FlowEvent.STATE_CHANGE_PENDING);

    const cb: VoidCallback = this.onStateChangePerformed_.bind(this, this._state, newState);

    // we can go to completed from any state
    if (newState === FlowState.COMPLETED) {
      this.onCompleted_(cb);
      return;
    }

    const currentState = this._state;
    switch (currentState) {
    case FlowState.COMPLETED:
      fail();
      break;
    case FlowState.VOID:
      if (newState !== FlowState.WAITING) {
        fail();
      }
      this.onVoidToWaiting_(cb);
      break;
    case FlowState.WAITING:
      if (newState === FlowState.FLOWING) {
        this.onWaitingToFlowing_(cb);
      } else if (newState === FlowState.VOID) {
        this.onWaitingToVoid_(cb);
      } else {
        fail();
      }
      break;
    case FlowState.FLOWING:
      if (newState !== FlowState.WAITING) {
        fail();
      }
      this.onFlowingToWaiting_(cb);
      break;
    }

    function fail () {
      this._pendingState = null;
      throw new Error(`Can not transition from flow state ${currentState} to ${newState}`);
    }
  }

  // more of a convenience since the setter exists but can't be public therefore
  // (Typescript wants accessors to agree in visibility)
  get state (): FlowState {
    return this._state;
  }

  protected setCompleted(completionResult: FlowCompletionResult, error: FlowError = null) {
    this._completionResultCode = completionResult.code;

    // enforce state change to completed
    this.state = FlowState.COMPLETED;
    switch(this._completionResultCode) {
    case FlowCompletionResultCode.NONE:
      throw new Error('Can not complete with no result');
    case FlowCompletionResultCode.OK:
      this._whenDoneResolve(completionResult);
      break;
    case FlowCompletionResultCode.FAILED:
      this._whenDoneReject(error);
      break;
    }
  }

  private onStateChangePerformed_ (previousState: FlowState, newState: FlowState) {
    this._prevState = previousState;
    this._state = newState;
    this._pendingState = null;
    this.onStateChangePerformed(this._prevState, this._state);

    this.emit(FlowEvent.STATE_CHANGED);
  }

  protected abstract onVoidToWaiting_(done: VoidCallback);
  protected abstract onWaitingToVoid_(done: VoidCallback);
  protected abstract onWaitingToFlowing_(done: VoidCallback);
  protected abstract onFlowingToWaiting_(done: VoidCallback);
  protected abstract onCompleted_(done: VoidCallback);

  protected abstract onStateChangeAborted_(reason: string);

}
