import { Processor, ProcessorEvent, ProcessorEventData } from './processor';
import { Socket, OutputSocket, SocketType, InputSocket } from './socket';
import { ErrorCode, ErrorCodeSpace, ErrorInfoSpace } from './error';
import { VoidCallback } from '../common-types';
import { EventEmitter } from 'eventemitter3';
import { getLogger, LoggerLevel } from '../logger';
import { AppInputSocket } from '../io-sockets/app-input-socket';
import { WebFileDownloadSocket } from '../io-sockets/web-file-download.socket';
import { makeTemplate } from '../common-utils';

const { error } = getLogger('Flow', LoggerLevel.DEBUG);

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

export type FlowError = ErrorInfoSpace<ErrorCodeSpace.FLOW> & {
  type: FlowErrorType
}

export enum FlowEvent {
  ERROR = 'flow:error',
  STATE_CHANGE_PENDING = 'flow:state-change-pending',
  STATE_CHANGE_ABORTED = 'flow:state-change-aborted',
  STATE_CHANGED = 'flow:state-changed'
}

export type FlowStateChangeCallback = (previousState: FlowState, newState: FlowState) => void;

export enum FlowConfigFlag {
  NONE = 0,
  WITH_APP_SOCKET = 0b01,
  WITH_DOWNLOAD_SOCKET = 0b10,
  ALL = 0xFFFFFFFF
}

// TODO: create generic Set class in objec-ts
export abstract class Flow extends EventEmitter<FlowEvent> {
  constructor (
    public readonly flags: FlowConfigFlag = FlowConfigFlag.NONE,
    private onStateChangePerformed: FlowStateChangeCallback = () => {},
    private onStateChangeAborted: (reason: string) => void = () => {},
    downloadSocketParams?: {el: HTMLElement, mimeType: string, filenameTemplateBase: string}
  ) {
    super();

    this._whenCompleted = new Promise((resolve, reject) => {
      this._whenCompletedResolve = resolve;
      this._whenCompletedReject = reject;
    });

    // eslint-disable-next-line no-lone-blocks
    {
      if (flags & FlowConfigFlag.WITH_APP_SOCKET) {
        this._appSocket = new AppInputSocket((blob: Blob) => {
          this.setCompleted({ code: FlowCompletionResultCode.OK, data: blob });
        }, true, true);
        this.addExternalSocket(this._appSocket);
      }

      if (flags & FlowConfigFlag.WITH_DOWNLOAD_SOCKET) {
        if (!downloadSocketParams) {
          throw new Error('Config has download socket enabled, but mandatory params missing');
        }
        this._downloadSocket = new WebFileDownloadSocket(
          downloadSocketParams.el,
          downloadSocketParams.mimeType,
          makeTemplate(downloadSocketParams.filenameTemplateBase)
        );
        this.addExternalSocket(this._downloadSocket);
      }
    }
  }

  private _downloadSocket: WebFileDownloadSocket = null;
  private _appSocket: AppInputSocket = null;
  private _state: FlowState = FlowState.VOID;
  private _pendingState: FlowState | null = null;
  private _prevState: FlowState | null = null;

  private _processors: Set<Processor> = new Set();
  private _extSockets: Set<Socket> = new Set();

  private _error: FlowError = null;

  private _whenCompleted: Promise<FlowCompletionResult>;
  private _whenCompletedResolve: (value: FlowCompletionResult) => void = null;
  private _whenCompletedReject: (reason: FlowError) => void = null;
  private _completionResultCode: FlowCompletionResultCode = FlowCompletionResultCode.NONE;

  protected get extDownloadSocket (): WebFileDownloadSocket {
    return this._downloadSocket;
  }

  protected get extAppSocket (): AppInputSocket {
    return this._appSocket;
  }

  get procList (): Processor[] {
    return Array.from(this._processors);
  }

  get externalSockets (): Socket[] {
    return Array.from(this.getExternalSockets());
  }

  get latenciesMs(): number[] {
    return this.procList.map(p => p.latencyMs);
  }

  get latenciesTotalMs(): number {
    return this.latenciesMs.reduce((accu, val) => accu + val, 0);
  }

  getExternalSocketsByType (type: SocketType): Socket[] {
    return this.externalSockets.filter((s) => (type === s.type()));
  }

  getExternalInputSockets (): InputSocket[] {
    return <InputSocket[]> this.getExternalSocketsByType(SocketType.INPUT);
  }

  getExternalOutputSockets (): OutputSocket[] {
    return <OutputSocket[]> this.getExternalSocketsByType(SocketType.OUTPUT);
  }

  get error (): FlowError {
    return this._error;
  }

  hasFlag (flag: FlowConfigFlag): boolean {
    return !!(this.flags & flag);
  }

  addProc (...p: Processor[]): Flow {
    p.forEach((proc) => {
      this._processors.add(proc);

      proc.on(ProcessorEvent.ERROR, (data: ProcessorEventData) => this._onProcError(data));
    });
    return this;
  }

  removeProc (...p: Processor[]): Flow {
    p.forEach((proc) => {
      if (!this._processors.delete(proc)) {
        throw new Error('Set delete method returned false');
      }
    });
    return this;
  }

  cleanupProcs () {
    this.procList.forEach(proc => {
      proc.terminate();
    });
    this.removeProc(...this.procList);
  }

  whenCompleted (): Promise<FlowCompletionResult> {
    return this._whenCompleted;
  }

  getCurrentState (): FlowState {
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

    if (this.onStateChangeAborted) {
      this.onStateChangeAborted(reason);
    }

    this.emit(FlowEvent.STATE_CHANGE_ABORTED);
  }

  getExternalSockets (): Set<Socket> {
    return this._extSockets;
  }

  getCompletionResult (): FlowCompletionResultCode {
    return this._completionResultCode;
  }

  /**
   * Sets the state of the flow. State-changes are asynchroenous in principle, but can be sync if the
   * implementation does it so.
   *
   * State-changes can only be performed in the orders of VOID<->WAITING<->FLOWING
   *
   * The COMPLETED state is special in that it can be reached from any previous state.
   * However it has to be reached by calling setCompleted with some valid FlowCompletionResultCode value (not NONE).
   *
   * In principle as all state-changes are async (also the one to COMPLETED).
   *
   * Therefore, if the application wants to reach a "target" state (for example FLOWING) from an initial state VOID,
   * it should take care of listening to the state-change events in order to know when
   * to be able to set the next state-change, as to perform every asynchroneous state-change phase.
   *
   * NOTE/TODO: Generic convenience functions can easily be provided for travelling back and forth
   * through the flow-states.
   *
   */
  set state (newState: FlowState) {
    if (this._pendingState) {
      throw new Error('Flow state-change still pending: ' + this._pendingState);
    }

    if (newState === FlowState.COMPLETED &&
      this._completionResultCode === FlowCompletionResultCode.NONE) {
      throw new Error('state change to COMPLETED has to be triggered by setCompleted');
    }

    // update pending state
    this._pendingState = newState;
    this.emit(FlowEvent.STATE_CHANGE_PENDING);

    // this callback is passed to the flow implementators
    // state-transition validators. this is to allow async state transitions for implementors.
    // the implementor calls back once the state transition actually happens,
    // which will call our private onStateChangePerformed_ bound to the
    // respective argument values of current and new state to actually
    // update the state and call specific events. the implementation can of course
    // also callback synchroneously.
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

  get state (): FlowState {
    return this._state;
  }

  protected addExternalSocket (s: Socket): Flow {
    this._extSockets.add(s);
    return this;
  }

  protected connectWithAllExternalSockets (internalOut: OutputSocket) {
    this.getExternalSockets().forEach((extSocket) => {
      internalOut.connect(extSocket);
    });
  }

  protected setCompleted (completionResult: FlowCompletionResult, error: FlowError = null) {
    this._completionResultCode = completionResult.code;

    // now initiate state change to completed
    this.state = FlowState.COMPLETED;
    switch (this._completionResultCode) {
    case FlowCompletionResultCode.NONE:
      throw new Error('Can not complete with no result');
    case FlowCompletionResultCode.OK:
      this._whenCompletedResolve(completionResult);
      break;
    case FlowCompletionResultCode.FAILED:
      this._whenCompletedReject(error);
      break;
    }
  }

  private onStateChangePerformed_ (previousState: FlowState, newState: FlowState) {
    this._prevState = previousState;
    this._state = newState;
    this._pendingState = null;

    if (this.onStateChangePerformed) {
      this.onStateChangePerformed(this._prevState, this._state);
    }

    this.emit(FlowEvent.STATE_CHANGED);
  }

  private _onProcError (data: ProcessorEventData): void {
    error('got processor error event:', data);

    const errorData: FlowError = {
      space: ErrorCodeSpace.FLOW,
      type: FlowErrorType.PROC,
      code: ErrorCode.FLOW_INTERNAL,
      message: 'A processor part of this flow emitted an error event',
      innerError: data.error
    };

    this._error = errorData;

    this._whenCompletedReject(errorData);

    // error data can be retrieved by app:
    // - from this class error prop (whenever needed, right inside error-event handler)
    // - from whenCompleted().catch(...) in async
    this.emit(FlowEvent.ERROR);
  }

  protected abstract onVoidToWaiting_(done: VoidCallback);
  protected abstract onWaitingToVoid_(done: VoidCallback);
  protected abstract onWaitingToFlowing_(done: VoidCallback);
  protected abstract onFlowingToWaiting_(done: VoidCallback);
  protected abstract onCompleted_(done: VoidCallback);

  protected abstract onStateChangeAborted_(reason: string);
}

export class DefaultFlow extends Flow {
  protected onVoidToWaiting_ (done: VoidCallback) {}
  protected onWaitingToVoid_ (done: VoidCallback) {}
  protected onWaitingToFlowing_ (done: VoidCallback) {}
  protected onFlowingToWaiting_ (done: VoidCallback) {}
  protected onCompleted_ (done: VoidCallback) {}
  protected onStateChangeAborted_ (reason: string) {}
}
