import {BufferSlices, BufferSlice, BufferProperties} from './buffer';

export class Packet {
  static fromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    mimeType?: string,
    sampleDuration?: number,
    samplesCount?: number): Packet {

    const p = new Packet();
    const bufferProps = new BufferProperties(mimeType, sampleDuration, samplesCount);

    return Packet.fromSlice(new BufferSlice(
      arrayBuffer,
      0,
      arrayBuffer.byteLength,
      bufferProps
    ))
  }

  static fromSlice(bufferSlice: BufferSlice): Packet {
    const p = new Packet();

    p.data.push(
      bufferSlice
    )

    return p;
  }

  data: BufferSlices = [];
  timestamp: number = 0;
  presentationTimeOffset: number = 0;
  createdAt: Date = new Date();

  constructor() {}

  getPresentationTime(): number {
    return this.timestamp + this.presentationTimeOffset;
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

