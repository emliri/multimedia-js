import {PayloadDescriptor} from './mime-type';

export class BufferProperties extends PayloadDescriptor {
    mediaKey: any;
    params: Object;
    samplesCount: number;
    timestampDelta: number;

    constructor(mimeType = 'unknown', sampleDuration = -1) {
        super(mimeType);

        this.sampleDuration = sampleDuration
        this.samplesCount = 0;
        this.timestampDelta = 0;

        this.params = {};
        this.mediaKey = null;
    }

    getTotalDuration() {
        return this.sampleDuration * this.samplesCount;
    }
}

export class BufferSlice {

    props: BufferProperties;
    arrayBuffer: ArrayBuffer;
    offset: number;
    length: number;

    constructor(arrayBuffer: ArrayBuffer,
        offset: number = 0,
        length: number = arrayBuffer.byteLength,
        props: BufferProperties = new BufferProperties()) {

      this.arrayBuffer = arrayBuffer;

      if(offset < 0 || length < 0) {
          throw new Error('Illegal parameters for BufferSlice window');
      }

      this.offset = offset;
      this.length = length;

      this.props = props
    }

    getDataView(): DataView {
      return new DataView(this.arrayBuffer, this.offset, this.length);
    }

    getBuffer(): Buffer {
      if (!global.Buffer) {
        throw new Error('`Buffer` is not supported as built-in class')
      }
      return Buffer.from(this.arrayBuffer, this.offset, this.length)
    }

    getUint8Array(): Uint8Array {
      return new Uint8Array(this.arrayBuffer)
    }
}

export type BufferSlices = BufferSlice[];
