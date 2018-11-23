import { ProcessorTask } from './processor-task';

import { makeUUID_v1 } from '../common-crypto';

import { getLogger } from '../logger';

import { processTSDemuxerAppend } from '../processors/hlsjs-ts-demux/ts-demuxer-task';

const context: Worker = self as any;
const workerId = makeUUID_v1();
const { log } = getLogger(`base-worker-${workerId}`);

(function () {
  let nextJobId = 0;

  // Respond to message from parent thread
  context.addEventListener('message', onMessage);

  function onMessage (event: Event) {
    log('Got message passed:', event);

    processTask(<ProcessorTask> (event as any).data);
  }

  function processTask (task: ProcessorTask) {
    task.workerContext = context;

    log(`Processing task "${task.name}" under job-id ${nextJobId} now ...`);

    const startTime = performance.now();

    switch (task.name) {
    case 'tsdemuxer':
      processTSDemuxerAppend(task);
      break;
    default:
      throw new Error('Unknown task: ' + task.name);
    }

    const endTime = performance.now();
    const latencyMs = endTime - startTime;

    log(`Processed task in ${latencyMs.toFixed(3)} ms, done with job-id ${nextJobId}`);

    nextJobId++;
  }
})();
