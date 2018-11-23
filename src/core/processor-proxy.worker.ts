import { ProcessorProxyWorkerSubContext,
  ProcessorProxyWorkerMessageData,
  ProcessorProxyWorkerMessage,
  ProcessorProxyWorkerCallbackData,
  ProcessorProxyWorkerCallback,
  ProcessorProxyWorkerCallbackTransferValue } from "./processor-proxy";
import { ProcessorEvent, ProcessorEventData } from "./processor";
import { OutputSocket, InputSocket } from "./socket";
import { Packet } from "./packet";

import { makeUUID_v1 } from "../common-crypto";
import { getLogger } from "../logger";

import { Processors } from '../../index';
import { copyToNewArrayBuffer, copyArrayBufferCollection } from "../common-utils";

const workerId = makeUUID_v1();
const { log, warn, error } = getLogger(`ProcessorProxyWorker#${workerId}`);

log('setting new worker instance up ...');

(function () {

  const context: Worker = self as any;
  const subContexts: ProcessorProxyWorkerSubContext[] = [];

  context.addEventListener('message', onMessage);

  function getSubContextById(id: number): ProcessorProxyWorkerSubContext {
    if (id >= subContexts.length) {
      error('Failure retrieving subcontext by id:', id);
      throw new Error('Subcontext-id is not valid: ' + id);
    }
    return subContexts[id];
  }

  function onMessage (event: MessageEvent) {
    log('got message passed:', event.data.message);

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
      context.postMessage(callbackData)

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

      const onEvent = (eventData: ProcessorEventData) => {

        const callbackData: ProcessorProxyWorkerCallbackData = {
          callback: ProcessorProxyWorkerCallback.EVENT,
          subContextId: subContext.id,
          processorName: subContext.name,
          workerId,
          value: eventData.event
        }

        context.postMessage(callbackData);
      }

      subContext.processor.on(ProcessorEvent.INPUT_SOCKET_CREATED, onEvent);
      subContext.processor.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onEvent);
      subContext.processor.on(ProcessorEvent.SYMBOLIC_PACKET, onEvent);
      subContext.processor.on(ProcessorEvent.SIGNAL, onEvent);

      subContext.processor.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {

        const outputSocket = OutputSocket.fromUnsafe(data.socket);
        const outputIndex = subContext.processor.out.length - 1;

        outputSocket.connect(new InputSocket((p: Packet) => {

          const packet = Packet.makeTransferableCopy(p); // NOT ideal in terms of performance and allocation
                                                         // BETTER: remap the same amount arraybuffers<->slices

          const transferValue: ProcessorProxyWorkerCallbackTransferValue = {
            packet,
            outputIndex
          }

          const callbackData: ProcessorProxyWorkerCallbackData = {
            callback: ProcessorProxyWorkerCallback.TRANSFER,
            subContextId: subContext.id,
            processorName: subContext.name,
            workerId,
            value: transferValue
          }

          context.postMessage(callbackData, packet.mapArrayBuffers());

          return true
        }, outputSocket.descriptor()));
      });

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.CREATED,
        subContextId: subContext.id,
        processorName: subContext.name,
        workerId,
        value: subContext.id
      }
      context.postMessage(callbackData)

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

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.TERMINATED,
        subContextId: subContext.id,
        processorName: subContext.name,
        workerId,
        value: subContext.id
      }
      context.postMessage(callbackData)

      break;
    }
    case ProcessorProxyWorkerMessage.INVOKE_METHOD: {
      const subContext = getSubContextById(data.subContextId);
      if (typeof data.args[0] !== 'string') {
        throw new Error('Call needs string method-name as first argument');
      }
      // stuff that might crash...
      let returnVal;
      const methodName = data.args.shift();
      try {
        returnVal = (subContext.processor[methodName] as Function)(...data.args);
      } catch(err) {
        error('Failure calling processor-method caused error:', err);
      }

      if (typeof returnVal === 'object') {
        returnVal = JSON.stringify(returnVal);
      }

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.METHOD_RETURN,
        subContextId: subContext.id,
        processorName: subContext.name + '.' + methodName,
        workerId,
        value: returnVal
      }
      context.postMessage(callbackData)

      break;
    }
    default: throw new Error('Unknown message type: ' + data.message);
    }
  }

})();
