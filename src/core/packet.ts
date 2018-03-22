import {BufferSlices, BufferSlice, BufferProperties} from './buffer';

export class Packet {

  data: BufferSlices;
  timestamp: number;
  createdAt: Date;

  static fromArrayBuffer(arrayBuffer: ArrayBuffer, mimeType?: string, sampleDuration?: number): Packet {
    const p = new Packet()
    p.data.push(new BufferSlice(
      arrayBuffer,
      0,
      arrayBuffer.byteLength,
      new BufferProperties(mimeType, sampleDuration)
    ))
    return p
  }

  constructor() {
    this.data = [];
    this.timestamp = 0;
    this.createdAt = new Date();
  }

  forEachBufferSlice(
    method: (bs: BufferSlice) => void,
    errorHandler: (bs: BufferSlice, err: Error) => void = null,
    context: any = null) {

    this.data.forEach((bufferSlice) => {
      if (context) {
        method = method.bind(context)
        if (errorHandler) {
          errorHandler = errorHandler.bind(context)
        }
      }
      try {
        method(bufferSlice)
      } catch(err) {
        if (errorHandler) {
          errorHandler(bufferSlice, err)
        } else {
          throw err
        }
      }
    })
  }
}

export type PacketReceiveCallback = ((p: Packet) => boolean);

