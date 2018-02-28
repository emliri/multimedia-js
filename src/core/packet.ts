import {BufferSlices, BufferSlice} from './buffer';

export class Packet {

    data: BufferSlices;
    timestamp: number;
    createdAt: Date;

    static fromArrayBuffer(arrayBuffer: ArrayBuffer): Packet {
      const p = new Packet()
      p.data.push(new BufferSlice(arrayBuffer))
      return p
    }

    constructor() {
        this.data = [];
        this.timestamp = 0;
        this.createdAt = new Date();
    }
}

export type PacketReceiveCallback = ((p: Packet) => boolean);

