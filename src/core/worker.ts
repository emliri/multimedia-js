import { Packet } from "./packet";

export type WorkerTask = {
  name: string,
  packet: Packet,
  state?: any,
}

export type WorkerMessage = {
  packet: Packet
}
