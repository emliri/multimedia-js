import { makeUUID_v1 } from "./common-crypto";
import { getLogger } from "./logger";
import { Processor, ProcessorEvent, ProcessorEventData } from "./core/processor";

import { Processors } from '../index';
import { InputSocket, SocketDescriptor, OutputSocket } from "./core/socket";
import { Packet, PacketSymbol } from "./core/packet";

const PROXY_WORKER_PATH = 'MMProcessorProxyWorker.umd.js'

const workerId = makeUUID_v1();
const { log, debug, warn, error } = getLogger(`ProcessorWorker#${workerId}`);
const context: Worker = self as any;
const subContexts: ProcessorProxyWorkerSubContext[] = [];

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
  RETURN = 'return',
  TRANSFER = 'transfer'
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

export class ProcessorProxyWorker extends Worker {

  private _subContextId: number = null;

  constructor(
    private _onTransfer: (value: ProcessorProxyWorkerCallbackTransferValue) => void,
    private _onSpawned: () => void
  ) {
    super(PROXY_WORKER_PATH);

    this.spawn();

    this.addEventListener('message', (event: MessageEvent) => {
      const callbackData: ProcessorProxyWorkerCallbackData = <ProcessorProxyWorkerCallbackData> event.data;

      switch (callbackData.callback) {
      case ProcessorProxyWorkerCallback.SPAWNED: {
        this._subContextId = callbackData.value;
        this._onSpawned();
        break;
      }
      case ProcessorProxyWorkerCallback.RETURN: {
        debug('Return value from call to proxy processor method: ', callbackData);
        break;
      }
      case ProcessorProxyWorkerCallback.TRANSFER: {
        const transferValue: ProcessorProxyWorkerCallbackTransferValue = callbackData.value;
        this._onTransfer(transferValue);
        break;
      }
      }
    });
  }

  get subContextId() {
    return this._subContextId;
  }

  spawn() {
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.SPAWN,
      subContextId: null,
      args: null
    }
    this.postMessage(message);
  }

  destroy(subContextId: number) {
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.DESTROY,
      subContextId,
      args: null
    }
    this.postMessage(message);
  }

  create(subContextId: number, procName: string, procConstructorArgs: any[]) {
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.CREATE,
      subContextId,
      args: [process, ...procConstructorArgs]
    }
    this.postMessage(message);
  }

  invokeMethod(subContextId, methodName: string, methodArgs: any[]) {
    const message: ProcessorProxyWorkerMessageData = {
      message: ProcessorProxyWorkerMessage.INVOKE_METHOD,
      subContextId,
      args: [methodName, ...methodArgs]
    }
    this.postMessage(message);
  }

}

export class ProcessorProxy extends Processor {

  private _worker: ProcessorProxyWorker;
  private _isReady: boolean = false;

  constructor(
    readonly processorFactoryname: string,
    onReady: () => void
  ) {
    super();

    this._worker = new ProcessorProxyWorker(
      (transferValue) => {
        this.onTransferFromOutputCallback(transferValue.packet, transferValue.outputIndex);
      },
      () => {
        this._isReady = true;
        onReady();
      });
  }

  get isReady() {
    return this._isReady;
  }

  createInput(sd: SocketDescriptor) {
    this._worker.invokeMethod(this._worker.subContextId, 'createInput', [sd]);
    return super.createInput(sd);
  }

  createOutput(sd: SocketDescriptor) {
    this._worker.invokeMethod(this._worker.subContextId, 'createOutput', [sd]);
    return super.createOutput(sd)
  }

  protected processTransfer_(inS: InputSocket, p: Packet, inputIndex: number): boolean {
    this._worker.invokeMethod(this._worker.subContextId, 'processTransfer_', [inS, p, inputIndex]);
    return true;
  }

  protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
    return false;
  }

  private onTransferFromOutputCallback(p: Packet, outputIndex: number) {
    const packet = Packet.fromTransferable(p);
    this.out[outputIndex].transfer(packet)
  }

  // TODO: figure what to do about signals...

}

export type ProcessorProxyWorkerSubContext = {
  id: number
  workerId: number
  processor: Processor
  name: string
};

(function () {

  context.addEventListener('message', onMessage);

  function getSubContextById(id: number): ProcessorProxyWorkerSubContext {
    if (id >= subContexts.length) {
      error('Failure retrieving subcontext by id:', id);
      throw new Error('Subcontext-id is not valid: ' + id);
    }
    return subContexts[id];
  }

  function onMessage (event: MessageEvent) {
    log('Got message passed:', event.data.message);

    const data: ProcessorProxyWorkerMessageData = <ProcessorProxyWorkerMessageData> event.data;

    switch(data.message) {
    case ProcessorProxyWorkerMessage.SPAWN: {
      const subContext = {
        id: subContexts.length,
        workerId: workerId,
        processor: null,
        name: null
      }
      subContexts.push(subContext);

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.SPAWNED,
        subContextId: subContext.id,
        processorName: subContext.name,
        workerId,
        value: subContext.id
      }
      this.postMessage(callbackData)

      break;
    }
    case ProcessorProxyWorkerMessage.DESTROY: {
      const subContext = getSubContextById(data.subContextId);
      if (subContext) {
        subContexts.splice(subContext.id, 1);
      } else {
        warn('no subcontext to destroy with id: ' + data.subContextId);
      }
      break;
    }
    case ProcessorProxyWorkerMessage.CREATE: {
      const subContext = getSubContextById(data.subContextId);
      if (subContext.processor) {
        error('Failure applying proxy worker message:', data);
        throw new Error('Can not create proc on sub-context, already exists. Id: ' + subContext.id);
      }
      const procName = data.args.shift();
      if (typeof procName !== 'string') {
        throw new Error('First argument should be string processor-name');
      }
      if (!Processors[procName]) {
        warn('Processor-name not found in proxy-factory: ' + procName)
        throw new Error('Processor not found by name: ' + procName);
      }
      subContext.name = procName;
      // we have no idea what can happen here ...
      try {
        subContext.processor = new Processors[procName](...data.args);
      } catch(err) {
        error('Failure calling processor-constructor caused error:', err);
      }

      if (!subContext.processor) {
        return;
      }

      subContext.processor.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {

        const outputSocket = OutputSocket.fromUnsafe(data.socket);
        const outputIndex = subContext.processor.out.length - 1;

        outputSocket.connect(new InputSocket((p: Packet) => {

          const transferValue: ProcessorProxyWorkerCallbackTransferValue = {
            packet: p,
            outputIndex
          }

          const callbackData: ProcessorProxyWorkerCallbackData = {
            callback: ProcessorProxyWorkerCallback.TRANSFER,
            subContextId: subContext.id,
            processorName: subContext.name,
            workerId,
            value: transferValue
          }
          this.postMessage(callbackData, p.mapArrayBuffers())

          return true
        }, outputSocket.descriptor()));
      })

      break;
    }
    case ProcessorProxyWorkerMessage.TERMINATE: {
      const subContext = getSubContextById(data.subContextId);
      if (!subContext.processor) {
        error('Failure applying proxy worker message:', data);
        throw new Error('Can not terminate proc on sub-context, does not exist. Id: ' + subContext.id);
      }
      subContext.processor.terminate();
      subContext.processor = null
      break;
    }
    case ProcessorProxyWorkerMessage.INVOKE_METHOD: {
      const subContext = getSubContextById(data.subContextId);
      if (typeof data.args[0] !== 'string') {
        throw new Error('Call needs string method-name as first argument');
      }
      // stuff that might crash...
      let returnVal;
      try {
        returnVal = (subContext.processor[data.args.shift()] as Function)(...data.args);
      } catch(err) {
        error('Failure calling processor-method caused error:', err);
      }

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.RETURN,
        subContextId: subContext.id,
        processorName: subContext.name,
        workerId,
        value: returnVal
      }
      this.postMessage(callbackData)

      break;
    }
    default: throw new Error('Unknown message type: ' + data.message);
    }
  }

});
