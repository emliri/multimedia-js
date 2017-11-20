import {BufferSlices} from './buffer';

export class Packet {

    data: BufferSlices;
    timestamp: number;
    createdAt: Date;

    constructor() {
        this.data = [];
        this.timestamp = 0;
        this.createdAt = new Date();
    }
}

export type PacketReceiveCallback = ((p: Packet) => boolean);

