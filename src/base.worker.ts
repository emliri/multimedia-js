import { WorkerTask, WorkerMessage } from "./core/worker";

import { makeUUID_v1 } from './common-crypto';

import {getLogger} from './logger';

import * as Thumbcoil from './ext-mod/thumbcoil/dist/thumbcoil'

import { Packet } from "./core/packet";

declare var self;

const context: Worker = self as any;
const workerId = makeUUID_v1();
const {log} = getLogger(`base-worker-${workerId}`);

(function (){

  let nextJobId = 0;

  // Respond to message from parent thread
  context.addEventListener("message", onMessage);

  function onMessage(event: Event) {
    log('Got message passed:', event)

    processTask(<WorkerTask> (event as any).data);
  }

  function processTask(task: WorkerTask) {
    log(`Processing task "${task.name}" under job-id ${nextJobId} now ...`);
    const startTime = performance.now();
    switch(task.name) {
    case 'ts-inspect':
      processTsInspect(task);
      break;
    default:
      throw new Error('Unknown task: ' + task.name);
    }
    const endTime = performance.now();

    const latencyMs = endTime - startTime

    log(`Processed task in ${latencyMs.toFixed(3)} ms, done with job-id ${nextJobId}`)

    nextJobId++;
  }

  function postMessage(wm: WorkerMessage) {
    context.postMessage(wm, wm.packet.mapArrayBuffers());
  }

  function processTsInspect(task: WorkerTask) {

    ensureShimDOMForThumbcoil();

    const p = Packet.fromTransferable(task.packet);

    p.forEachBufferSlice((bufferSlice) => {

      const parsedData = Thumbcoil.tsInspector.inspect(new Uint8Array(bufferSlice.arrayBuffer))

      Thumbcoil.tsInspector.domify(parsedData)

      log(parsedData)

      /*
      postMessage({
        packet: Packet.from
      })
      */

      parsedData.esMap.forEach((payloadUnit) => {
        switch(payloadUnit.type) {
        case 'video':
          break;
        case 'audio':
          break;
        }
      })

    })
  }

})();

function ensureShimDOMForThumbcoil() {
  if (self.document) {
    return;
  }

  const noop = function() {};

  // Shim needed to run TsInspector without DOM
  self.document = {
    createElement: () => {
      return {
        classList: {
          add: noop
        },
        appendChild: noop,
        setAttribute: noop
      }
    },
  }
}



