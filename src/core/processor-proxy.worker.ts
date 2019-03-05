import { ProcessorProxyWorkerSubContext,
  ProcessorProxyWorkerMessageData,
  ProcessorProxyWorkerMessage,
  ProcessorProxyWorkerCallbackData,
  ProcessorProxyWorkerCallback,
  ProcessorProxyWorkerCallbackTransferValue } from './processor-proxy';
import { ProcessorEvent, ProcessorEventData } from './processor';
import { OutputSocket, InputSocket } from './socket';
import { Packet } from './packet';

import { makeUUID_v1 } from '../common-crypto';
import { getLogger, LoggerLevel } from '../logger';

import { Processors } from '../../index';

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts
 */
let var importScripts: (...paths: string[]) => void;

const workerId = makeUUID_v1();
const { log, debug, warn, error } = getLogger(`ProcessorProxyWorker#${workerId}`, LoggerLevel.LOG);

log('setting new worker instance up ...');

(function () {
  const context: Worker = self as any;
  const subContexts: ProcessorProxyWorkerSubContext[] = [];

  context.addEventListener('message', onMessage);

  function getSubContextById (id: number): ProcessorProxyWorkerSubContext {
    if (id >= subContexts.length) {
      error('Failure retrieving subcontext by id:', id);
      throw new Error('Subcontext-id is not valid: ' + id);
    }
    return subContexts[id];
  }

  function onMessage (event: MessageEvent) {
    debug('got message passed:', event.data.message);

    const data: ProcessorProxyWorkerMessageData = <ProcessorProxyWorkerMessageData> event.data;

    switch (data.message) {
    case ProcessorProxyWorkerMessage.SPAWN: {
      const subContext = {
        id: subContexts.length,
        workerId: workerId,
        processor: null,
        name: null
      };
      subContexts.push(subContext);

      let failed = false;
      data.args && data.args.forEach((scriptPath) => {
        log('loading script for external dependency:', scriptPath);
        try {
          importScripts(scriptPath);
        } catch (err) {
          warn(`error in imported script: '${scriptPath}'`);
          error(err);
          failed = true;
        }
      });

      if (failed) {
        error('loading external scripts failed; aborting');
        return;
      }

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.SPAWNED,
        subContextId: subContext.id,
        processorName: subContext.name,
        workerId,
        value: subContext.id
      };
      context.postMessage(callbackData);

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
        warn('Processor-name not found in proxy-factory: ' + procName);
        throw new Error('Processor not found by name: ' + procName);
      }
      subContext.name = procName;
      // we have no idea what can happen here ...
      try {
        subContext.processor = new Processors[procName](...data.args);
      } catch (err) {
        error('Failure calling processor-constructor; caused error:', err);
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
        };

        context.postMessage(callbackData);
      };

      subContext.processor.on(ProcessorEvent.INPUT_SOCKET_CREATED, onEvent);
      subContext.processor.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onEvent);
      subContext.processor.on(ProcessorEvent.SYMBOLIC_PACKET, onEvent);
      subContext.processor.on(ProcessorEvent.SIGNAL, onEvent);
      subContext.processor.on(ProcessorEvent.ERROR, onEvent);

      const onOutputSockeTransfer = (outputIndex: number, p: Packet) => {
        if (p.isSymbolic()) {
          log('making transferrable symbolic packet');
        }

        // p.forEachBufferSlice((bs) => debug(bs.toString()))

        const packet = Packet.makeTransferableCopy(p); // NOT ideal in terms of performance and allocation
        // BETTER: remap the same amount arraybuffers<->slices

        packet.forEachBufferSlice((bs) => debug(bs.toString()));

        const transferValue: ProcessorProxyWorkerCallbackTransferValue = {
          packet,
          outputIndex
        };

        const callbackData: ProcessorProxyWorkerCallbackData = {
          callback: ProcessorProxyWorkerCallback.TRANSFER,
          subContextId: subContext.id,
          processorName: subContext.name,
          workerId,
          value: transferValue
        };

        context.postMessage(callbackData, packet.mapArrayBuffers());

        return true;
      };

      const wireUpOutputSocket = (outputSocket: OutputSocket, outputIndex: number) => {
        outputSocket.connect(new InputSocket(onOutputSockeTransfer.bind(this, outputIndex), outputSocket.descriptor()));
      };

      subContext.processor.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
        const outputSocket = OutputSocket.fromUnsafe(data.socket);
        const outputIndex = subContext.processor.out.length - 1;

        wireUpOutputSocket(outputSocket, outputIndex);
      });

      // finally, make sure to wire up the output-sockets that already existed *before* we set up the above event listener
      // i.e the ones created in the proc constructor
      subContext.processor.out.forEach(wireUpOutputSocket);

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.CREATED,
        subContextId: subContext.id,
        processorName: subContext.name,
        workerId,
        value: subContext.id
      };
      context.postMessage(callbackData);

      break;
    }
    case ProcessorProxyWorkerMessage.TERMINATE: {
      const subContext = getSubContextById(data.subContextId);
      if (!subContext.processor) {
        error('Failure applying proxy worker message:', data);
        throw new Error('Can not terminate proc on sub-context, does not exist. Id: ' + subContext.id);
      }
      subContext.processor.terminate();
      subContext.processor = null;

      const callbackData: ProcessorProxyWorkerCallbackData = {
        callback: ProcessorProxyWorkerCallback.TERMINATED,
        subContextId: subContext.id,
        processorName: subContext.name,
        workerId,
        value: subContext.id
      };
      context.postMessage(callbackData);

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

      if (!subContext.processor) {
        error('attempt to invoke method, but no processor instance spawned in context:', methodName,
          '; sub-context id:', subContext.id);
        return;
      }

      try {
        returnVal = (subContext.processor[methodName] as Function)(...data.args);
      } catch (err) {
        error('Failure calling processor-method:', methodName, 'caused error:', err);
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
      };
      context.postMessage(callbackData);

      break;
    }
    default: throw new Error('Unknown message type: ' + data.message);
    }
  }
})();
