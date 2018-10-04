import { Packet } from "./packet";

export type WorkerTask = {
  workerContext: Worker,
  name: string,
  packet: Packet,
}

export type WorkerMessage = {
  packet: Packet
}

export function postMessage(context: Worker, wm: WorkerMessage) {
  context.postMessage(wm, wm.packet.mapArrayBuffers());
}

