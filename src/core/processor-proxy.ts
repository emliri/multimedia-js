import { makeUUID_v1 } from "../common-crypto";
import { getLogger, LoggerLevels } from "../logger";
import { Processor, ProcessorEvent } from "./processor";
import { InputSocket, SocketDescriptor, SocketType } from "./socket";
import { Packet, PacketSymbol } from "./packet";
import { createProcessorFromShellName } from "./processor-factory";
import { VoidCallback } from "../common-types";

const PROXY_WORKER_PATH = '/dist/MMProcessorProxyWorker.umd.js'; // FIXME nasty HACK!! -> make this configurable

const { log, debug, error } = getLogger(`ProcessorProxy`, LoggerLevels.LOG);

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

export class ProcessorProxyWorker {

  private _subContextId: number = null;
  private _worker: Worker = null

  constructor(
    private _onSpawned: VoidCallback,
    private _onCreated: VoidCallback,
    private _onTransfer: (value: ProcessorProxyWorkerCallbackTransferValue) => void,
    private _onMethodReturn: (retValue: any) => void,
    private _onEvent: (event: ProcessorEvent) => void,
  ) {

    try {
      this._worker = new Worker(PROXY_WORKER_PATH);
      log('created web-worker wrapper from filepath:', PROXY_WORKER_PATH)
    } catch(err) {
      error('failed to initialize worker:', err);
      return this;
    }

    this._worker.addEventListener('error', (event: Event) => {
      error('error on worker:', event);
    })

    this._worker.addEventListener('message', (event: MessageEvent) => {
      const callbackData: ProcessorProxyWorkerCallbackData = <ProcessorProxyWorkerCallbackData> event.data;

      debug('message received:', event)

      switch (callbackData.callback) {
      case ProcessorProxyWorkerCallback.SPAWNED: {
        this._subContextId = callbackData.value;
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
      default: throw new Error('unknown callback type: ' + callbackData.callback)
      }
    });
  }

  get subContextId() {
    // little hacky trick: we pass 0 instead of the actual subContextId because we only use one context anyway
    // for supporting multiple sub-contexts per worker instance (to share one across several proxied procs) we
    // can only allow async proxy initialization (create only called from the spawned-callback after we have set the subContextId on this the shell side)
    return this._subContextId || 0;
  }

  spawn() {
    log('spawn called')
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.SPAWN,
      subContextId: null,
      args: null
    }
    this._worker.postMessage(message);
  }

  destroy(subContextId: number) {
    log('destroy called')
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.DESTROY,
      subContextId,
      args: null
    }
    this._worker.postMessage(message);
  }

  create(subContextId: number, procName: string, procConstructorArgs: any[]) {
    log('create called for processor shell-name: ', procName)
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.CREATE,
      subContextId,
      args: [procName, ...procConstructorArgs]
    }
    this._worker.postMessage(message);
  }

  invokeMethod(subContextId, methodName: string, methodArgs: any[], transferrables?: ArrayBuffer[]) {
    log('invoke method called:', methodName)
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.INVOKE_METHOD,
      subContextId,
      args: [methodName, ...methodArgs]
    }
    this._worker.postMessage(message, transferrables);
  }

}

export class ProcessorProxy extends Processor {

  private _worker: ProcessorProxyWorker;
  private _isReady: boolean = false;
  private _protoInstanceSocketsCreated = 0;

  constructor(
    readonly processorShellName: string, // TODO: pass in constructor instead and do factory stuff outside of here
    onReady: VoidCallback
  ) {
    super();

    // disable proxying any symbols automatically
    this.enableSymbolProxying = false;
    // disable passing any symbols to process transfer
    this.muteSymbolProcessing = true;

    const onSpawned = () => {
      log(`worker spawned with sub-context-id ${this._worker.subContextId}`)
    }

    const onCreated = () => {
      log(`processor-proxy for shell-name ${this.processorShellName} is ready`);
      this._isReady = true;
      onReady();
    }

    const onTransfer = (transferValue: ProcessorProxyWorkerCallbackTransferValue) => {
      this._onTransferFromOutputCallback(transferValue.packet, transferValue.outputIndex);
    }

    const onMethodReturn = (returnVal: any) => {
      // TODO
      debug('return value from call to proxy processor method: ', returnVal);
    }

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

    const onEvent = (event: ProcessorEvent) => {
      switch(event) {
      case ProcessorEvent.INPUT_SOCKET_CREATED:
        if (decrementSocketCreatedCounter()) {
          super.createInput()
        }
        break;
      case ProcessorEvent.OUTPUT_SOCKET_CREATED:
        if (decrementSocketCreatedCounter()) {
          super.createOutput()
        }
        break;
      }
    }

    this._worker = new ProcessorProxyWorker(
      onSpawned,
      onCreated,
      onTransfer,
      onMethodReturn,
      onEvent
    );

    // all these "commands" will get queued by the worker thread anyway, we don't need to worry about synchronization at this point
    this._worker.spawn();
    this._worker.create(this._worker.subContextId, this.processorShellName, []);
    this._initProtoShell();

  }

  get isReady() {
    return this._isReady;
  }

  createInput(sd?: SocketDescriptor) {
    this._worker.invokeMethod(this._worker.subContextId, 'createInput', [sd]);
    return super.createInput(sd);
  }

  createOutput(sd?: SocketDescriptor) {
    this._worker.invokeMethod(this._worker.subContextId, 'createOutput', [sd]);
    return super.createOutput(sd)
  }

  protected processTransfer_(inS: InputSocket, p: Packet, inputIndex: number): boolean {
    // we can do this since we made sure that we wont get any symbolic packets in here
    this._worker.invokeMethod(this._worker.subContextId, '__invokeRPCPacketHandler__', [p, inputIndex], p.mapArrayBuffers());
    return true;
  }

  protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
    log(' symbol handler:', symbol)
    this._worker.invokeMethod(this._worker.subContextId, '__invokeRPCPacketHandler__', [Packet.fromSymbol(symbol)]);
    return true; // we return true here because we handle it somehow but generally proxying is disabled
                 // since this is something to be determined by the proxied instance
  }

  private _onTransferFromOutputCallback(p: Packet, outputIndex: number) {
    const packet = Packet.fromTransferable(p);
    if (packet.isSymbolic()) {
      log('received symbolic packet from worker with value:', p.symbol)
    }
    this.out[outputIndex].transfer(packet)
  }

  private _initProtoShell() {
    // make a utility like this to "clone" a proc ?
    const protoInstance = createProcessorFromShellName(this.processorShellName);
    // we are basically probing the proto instance of the proc and creating a clone of its template-generator function
    const socketTemplateGenerator = SocketDescriptor.createTemplateGenerator(
      protoInstance.templateSocketDescriptor(SocketType.INPUT),
      protoInstance.templateSocketDescriptor(SocketType.OUTPUT)
    );
    this.overrideSocketTemplate(socketTemplateGenerator);
    // FIXME: apply socket-descriptors
    protoInstance.in.forEach(() => {
      this.createInput();
    });
    protoInstance.out.forEach(() => {
      this.createOutput();
    });
    this._protoInstanceSocketsCreated = protoInstance.in.length + protoInstance.out.length;
  }

  // TODO: figure what to do about signals...

}
