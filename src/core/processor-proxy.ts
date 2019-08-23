import { makeUUID_v1 } from '../common-crypto';
import { getLogger, LoggerLevel } from '../logger';
import { Processor, ProcessorEvent, ProcessorEventData, PROCESSOR_RPC_INVOKE_PACKET_HANDLER } from './processor';
import { InputSocket, SocketDescriptor, SocketType, Socket } from './socket';
import { Packet, PacketSymbol } from './packet';
import { createProcessorFromShellName } from './processor-factory';
import { VoidCallback } from '../common-types';
import { EnvironmentVars } from '../core/env';
import { ErrorCode } from './error';

const { log, debug, warn, error } = getLogger('ProcessorProxy', LoggerLevel.ERROR);

export enum ProcessorProxyWorkerMessage {
  SPAWN = 'spawn',
  DESTROY = 'destroy',
  CREATE = 'create',
  TERMINATE = 'terminate',
  INVOKE_METHOD = 'invoke-method',
}

export type ProcessorProxyWorkerMessageData = {
  message: ProcessorProxyWorkerMessage
  subContextId: number
  args: any[]
}

export enum ProcessorProxyWorkerCallback {
  SPAWNED = 'spawned',
  DESTROYED = 'destroyed',
  CREATED = 'created',
  TERMINATED = 'terminated',
  METHOD_RETURN = 'return',
  TRANSFER = 'transfer',
  EVENT = 'event'
}

export type ProcessorProxyWorkerCallbackData = {
  callback: ProcessorProxyWorkerCallback
  subContextId: number
  workerId: number
  processorName: string,
  value: any
}

export type ProcessorProxyWorkerCallbackTransferValue = {
  packet: Packet
  outputIndex: number
}

export type ProcessorProxyWorkerSubContext = {
  id: number
  workerId: number
  processor: Processor
  name: string
};

// TODO: move this class to own file
export class ProcessorProxyWorker {
  private _subContextId: number = null;
  private _gotSpawnCallback: boolean = false;
  private _worker: Worker = null

  constructor (
    private _onSpawned: VoidCallback,
    private _onCreated: VoidCallback,
    private _onTransfer: (value: ProcessorProxyWorkerCallbackTransferValue) => void,
    private _onMethodReturn: (retValue: any) => void,
    private _onEvent: (event: ProcessorEventData) => void,
    private _onWorkerError: (event: ErrorEvent) => void
  ) {
    const PROXY_WORKER_PATH = EnvironmentVars.PROXY_WORKER_PATH;

    try {
      this._worker = new Worker(PROXY_WORKER_PATH);
      log('created web-worker wrapper from filepath:', PROXY_WORKER_PATH);
    } catch (err) {
      error('failed to initialize worker:', err);
      return this;
    }

    this._worker.addEventListener('error', (event: ErrorEvent) => {
      // trigger error event here to shell proc instance using event callback
      error(`error-event on worker: "${event.message}"`);
      this._onWorkerError(event);
    });

    this._worker.addEventListener('message', (event: MessageEvent) => {
      const callbackData: ProcessorProxyWorkerCallbackData = <ProcessorProxyWorkerCallbackData> event.data;

      debug('message received:', event);

      switch (callbackData.callback) {
      case ProcessorProxyWorkerCallback.SPAWNED: {
        this._subContextId = callbackData.value;
        this._gotSpawnCallback = true;
        this._onSpawned();
        break;
      }
      case ProcessorProxyWorkerCallback.CREATED: {
        this._onCreated();
        break;
      }
      case ProcessorProxyWorkerCallback.TRANSFER: {
        const transferValue: ProcessorProxyWorkerCallbackTransferValue = callbackData.value;
        this._onTransfer(transferValue);
        break;
      }
      case ProcessorProxyWorkerCallback.METHOD_RETURN: {
        this._onMethodReturn(callbackData.value);
        break;
      }
      case ProcessorProxyWorkerCallback.EVENT: {
        this._onEvent(callbackData.value);
        break;
      }
      default: throw new Error('unknown callback type: ' + callbackData.callback);
      }
    });
  }

  get subContextId () {
    // little hacky trick: we pass 0 instead of the actual subContextId because we only use one context anyway
    // for supporting multiple sub-contexts per worker instance (to share one across several proxied procs) we
    // can only allow async proxy initialization (create only called from the spawned-callback after we have set the subContextId on this the shell side)
    return this._subContextId || 0;
  }

  spawn (importScriptPaths: string[] = []) {
    const args = importScriptPaths;
    log('spawn called');
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.SPAWN,
      subContextId: null,
      args
    };
    this._worker.postMessage(message);
  }

  destroy (subContextId: number) {
    log('destroy called');
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.DESTROY,
      subContextId,
      args: null
    };
    this._worker.postMessage(message);
  }

  create (subContextId: number, procName: string, procConstructorArgs: any[]) {
    log('create called for processor shell-name: ', procName);
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.CREATE,
      subContextId,
      args: [procName, ...procConstructorArgs]
    };
    this._worker.postMessage(message);
  }

  invokeMethod (subContextId, methodName: string, methodArgs: any[], transferrables?: ArrayBuffer[]) {
    debug('invoke method called:', methodName);
    if (!this._gotSpawnCallback) {
      warn(`did not get 'spawned' callback message yet, but posting message to remote-invoke method (will be queued): '${methodName}'`);
    }
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.INVOKE_METHOD,
      subContextId,
      args: [methodName, ...methodArgs]
    };
    this._worker.postMessage(message, transferrables);
  }
}

export class ProcessorProxy extends Processor {
  private _worker: ProcessorProxyWorker;
  private _isReady: boolean = false;

  constructor (
    private readonly _processorShellName: string, // TODO: pass in constructor instead and do factory stuff outside of here
    onReady: VoidCallback,
    private readonly _processorArgs: any[] = [],
    private readonly _importScriptPaths: string[] = []
  ) {
    super();

    // disable proxying any symbols automatically
    this.enableSymbolProxying = false;
    // disable passing any symbols to process transfer
    this.muteSymbolProcessing = true;

    const onSpawned = () => {
      log(`worker spawned with sub-context-id ${this._worker.subContextId}`);
    };

    const onCreated = () => {
      log(`processor-proxy for shell-name ${_processorShellName} is ready`);
      this._isReady = true;
      onReady();
    };

    const onTransfer = (transferValue: ProcessorProxyWorkerCallbackTransferValue) => {
      this._onTransferFromOutputCallback(transferValue.packet, transferValue.outputIndex);
    };

    const onMethodReturn = (returnVal: any) => {
      // TODO
      debug('return value from call to proxy processor method: ', returnVal);
    };

    /*
    const decrementSocketCreatedCounter = () => {
      // we are doing this to count down the sockets
      // created by the proto-instance to avoid a double-feedback
      // that would result in creating these sockets twice
      // since ultimately these will also trigger events on the worker side.
      // we only want to mirror the socket creations
      // that we haven't initialized ourselves.
      if (this._protoInstanceSocketsCreated > 0) {
        this._protoInstanceSocketsCreated--
        return false;
      }
      return true;
    }
    */

    const onEvent = (eventData: ProcessorEventData) => {
      let data: ProcessorEventData;
      let socket: Socket;

      // we don't need to reproduce this event, it will be triggered organically from creating the sockets here
      // just as all other events except error

      let sd;
      if (eventData.socket) {
        sd = SocketDescriptor.fromJson(<any> eventData.socket);
      }

      switch (eventData.event) {
      case ProcessorEvent.INPUT_SOCKET_CREATED:
        socket = super.createInput(sd);
        break;
      case ProcessorEvent.OUTPUT_SOCKET_CREATED:
        socket = super.createOutput(sd);
        break;
      case ProcessorEvent.ERROR:
        // patch the proc ref back up with this proxys
        eventData.error.processor = this;
        // emit the synthesized proxied event (if we have any listeners)
        if (this.listenerCount(ProcessorEvent.ERROR)) {
          this.emit(ProcessorEvent.ERROR, {
            processor: this,
            event: ProcessorEvent.ERROR,
            error: eventData.error
          });
        // if we have no listeners, make sure the error is being seen
        } else {
          console.error(`Unhandled error code ${eventData.error.code} (${ErrorCode[eventData.error.code]}): ${eventData.error.message}`)
          if (eventData.error.nativeError) {
            console.error('Native error:', eventData.error.nativeError)
          }
        }

        break;
      }
    };

    const onWorkerError = (event: ErrorEvent) => {
      this.emit(ProcessorEvent.ERROR, {
        event: ProcessorEvent.ERROR,
        processor: this,
        socket: null
      });
    };

    this._worker = new ProcessorProxyWorker(
      onSpawned,
      onCreated,
      onTransfer,
      onMethodReturn,
      onEvent,
      onWorkerError
    );

    // all these "commands" will get queued by the worker thread anyway, we don't need to worry about synchronization at this point
    this._worker.spawn(_importScriptPaths);
    this._worker.create(this._worker.subContextId, _processorShellName, _processorArgs);
    this._initShellFromProtoInstance();
  }

  get workerShellProcName (): string {
    return this._processorShellName;
  }

  get isReady () {
    return this._isReady;
  }

  createInput (sd?: SocketDescriptor) {
    this._worker.invokeMethod(this._worker.subContextId, 'createInput', [sd]);
    return super.createInput(sd);
  }

  createOutput (sd?: SocketDescriptor) {
    this._worker.invokeMethod(this._worker.subContextId, 'createOutput', [sd]);
    return super.createOutput(sd);
  }

  protected processTransfer_ (inS: InputSocket, p: Packet, inputIndex: number): boolean {
    // we can do this since we made sure that we wont get any symbolic packets in
    const packet = Packet.makeTransferableCopy(p);
    this._worker.invokeMethod(
      this._worker.subContextId,
      PROCESSOR_RPC_INVOKE_PACKET_HANDLER,
      [packet, inputIndex],
      packet.mapArrayBuffers()
    );
    return true;
  }

  protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
    log('symbol handler:', symbol);
    this._worker.invokeMethod(
      this._worker.subContextId,
      PROCESSOR_RPC_INVOKE_PACKET_HANDLER,
      [Packet.fromSymbol(symbol)]
    );
    return true; // we return true here because we handle it somehow but generally proxying is disabled
    // since this is something to be determined by the proxied instance
  }

  private _onTransferFromOutputCallback (p: Packet, outputIndex: number) {
    const packet = Packet.fromTransferable(p);
    if (packet.isSymbolic()) {
      log('received symbolic packet from worker with value:', packet.symbol);
    }
    this.out[outputIndex].transfer(packet);
  }

  private _initShellFromProtoInstance () {
    // make a utility like this to "clone" a proc ?
    const protoInstance = createProcessorFromShellName(this._processorShellName, this._processorArgs);
    // we are basically probing the proto instance of the proc and creating a clone of its template-generator function
    const socketTemplateGenerator = SocketDescriptor.createTemplateGenerator(
      protoInstance.templateSocketDescriptor(SocketType.INPUT),
      protoInstance.templateSocketDescriptor(SocketType.OUTPUT)
    );
    this.overrideSocketTemplate(socketTemplateGenerator);
    // FIXME: apply socket-descriptors
    protoInstance.in.forEach(() => {
      super.createInput();
    });
    protoInstance.out.forEach(() => {
      super.createOutput();
    });
  }

  // TODO: figure what to do about signals...
}
