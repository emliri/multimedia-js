import { Packet } from './packet';

export type ProcessorTask = {
  workerContext: Worker,
  name: string,
  packet: Packet,
};

export type ProcessorTaskMessage = {
  packet: Packet
};

export function postTaskMessage (context: Worker, wm: ProcessorTaskMessage) {
  context.postMessage(wm, wm.packet.mapArrayBuffers());
}
