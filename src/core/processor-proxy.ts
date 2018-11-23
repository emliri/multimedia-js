import { makeUUID_v1 } from "../common-crypto";
import { getLogger } from "../logger";
import { Processor, ProcessorEvent } from "./processor";
import { InputSocket, SocketDescriptor, SocketType } from "./socket";
import { Packet, PacketSymbol } from "./packet";
import { createProcessorFromShellName } from "./processor-factory";

const PROXY_WORKER_PATH = '/dist/MMProcessorProxyWorker.umd.js'; // FIXME nasty HACK!! -> make this configurable

const { log, debug, warn, error } = getLogger(`ProcessorProxy`);

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

export class ProcessorProxyWorker {

  private _subContextId: number = null;
  private _worker: Worker = null

  constructor(
    private _onSpawned: () => void,
    private _onCreated: () => void,
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

      log('message received:', event)

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
    return this._subContextId;
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

  constructor(
    readonly processorShellName: string, // TODO: pass in constructor instead and do factory stuff outside of here
    onReady: () => void
  ) {
    super();

    const onSpawned = () => {
      log(`worker spawned with sub-context-id ${this._worker.subContextId}`)
      this._worker.create(this._worker.subContextId, this.processorShellName, []);
    }

    const onCreated = () => {
      log(`processor-proxy for shell-name ${this.processorShellName} is ready`);
      this._isReady = true;

      this._initProtoShell();

      onReady();
    }

    const onTransfer = (transferValue: ProcessorProxyWorkerCallbackTransferValue) => {
      this.onTransferFromOutputCallback(transferValue.packet, transferValue.outputIndex);
    }

    const onMethodReturn = (returnVal: any) => {
      // TODO
      debug('return value from call to proxy processor method: ', returnVal);
    }

    const onEvent = (event: ProcessorEvent) => {
      switch(event) {
      case ProcessorEvent.INPUT_SOCKET_CREATED:
        super.createInput()
        break;
      case ProcessorEvent.OUTPUT_SOCKET_CREATED:
        super.createOutput()
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

    this._worker.spawn();

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
    this._worker.invokeMethod(this._worker.subContextId, '__remotelyInvokeProcessTransfer__', [p, inputIndex], p.mapArrayBuffers());
    return true;
  }

  protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
    return false;
  }

  private onTransferFromOutputCallback(p: Packet, outputIndex: number) {
    const packet = Packet.fromTransferable(p);
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
  }

  // TODO: figure what to do about signals...

}

export type ProcessorProxyWorkerSubContext = {
  id: number
  workerId: number
  processor: Processor
  name: string
};
