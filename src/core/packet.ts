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
    errorHandler: (bs: BufferSlice, err: Error) => boolean = null,
    context: any = null) {

    let abort = false;
    // we use an on-stack shallow copy of the array to prevent any
    // side-effects on other manipulation of the packet itself from within
    // the loop we will run here.
    this.data.slice().forEach((bufferSlice) => {
      if (abort) {
        return;
      }
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
          if (!errorHandler(bufferSlice, err)) {
            abort = true;
            console.error('Packet buffers loop aborted: ', err)
          }
        } else {
          throw err
        }
      }
    })
  }
}

export type PacketReceiveCallback = ((p: Packet) => boolean);

