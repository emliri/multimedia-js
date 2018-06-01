import {PayloadDescriptor, UNKNOWN_MIMETYPE} from './mime-type';

/**
 * @class
 * Describes the payload of a buffer, how many samples it contains of that, and time-contextual information
 * for decrypting/decoding/presentation of the buffer.
 *
 * Generic media-key and parameters can be included as metadata around the buffer.
 *
 * Many buffer "slices" can (but must not) share one buffer-properties object instance, where that has advantages.
 *
 */
export class BufferProperties extends PayloadDescriptor {
    mediaKey: any;
    params: { [param: string] : any; };

    samplesCount: number;
    timestampDelta: number;

    constructor(mimeType = UNKNOWN_MIMETYPE, sampleDuration = NaN, sampleDepth = NaN, samplesCount = 0) {
        super(mimeType, sampleDuration, sampleDepth);

        this.samplesCount = samplesCount;
        this.timestampDelta = 0;

        this.params = {};
        this.mediaKey = null;
    }

    getTotalDuration() {
        return this.sampleDuration * this.samplesCount;
    }
}

/**
 * @class
 * A BufferSlice wraps a buffer of binary data (as an ArrayBuffer).
 *
 * The slice is what is represented by the offset and length properties (r/w),
 *
 * which can be modified at any time.
 *
 * These values are in turn used by the various DataView getters to form the data-representation window.
 * Those methods have optional arguments that overload the latter values.
 *
 * BufferSlice can be deep-copied (except properties), and ArrayBuffer.prototype.slice will be called. See `copy` methods.
 *
 * To actually get a clone of a BufferSlice instance with different offset/length window and new properties,
 * use the `unwrap` method.
 *
 * The `unwrap` method is convenient when building zero-copy parsers/demuxers to create new buffer instances
 * to push to outputs based on one input buffer slice type and the new buffers are simply windows into the input data.
 *
 */
export class BufferSlice {

    static copy(original: BufferSlice): BufferSlice {
      const thiz = original;
      const slice = new BufferSlice(thiz.arrayBuffer.slice(thiz.offset, thiz.offset + this.length));
      slice.props = thiz.props;
      return slice;
    }

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

    /**
     * Returns a *new* slice instance around the exact same data buffer with a fresh vanilla properties object (by default),
     * and the given offset/length window. Optionally new properties can be passed directly here.
     *
     * @param offset
     * @param length
     * @param props
     */
    unwrap(offset: number, length: number, props?: BufferProperties): BufferSlice {
      const slice = new BufferSlice(this.arrayBuffer, offset, length, props);
      return slice;
    }

    /**
     * Copies the actual underlying data and creates a new slice with the same properties.
     */
    copy(): BufferSlice {
      return BufferSlice.copy(this);
    }

    /**
     * Returns an ArrayBufferView for the internal buffer based on the current offset/length of this slice
     * or of the argument values.
     *
     * @param offset
     * @param length
     */
    getUint8Array(offset?: number, length?: number): Uint8Array {
      return new Uint8Array(this.arrayBuffer, offset || this.offset, length || this.length);
    }

    /**
     *
     * Returns an ArrayBufferView for the internal buffer based on the current offset/length of this slice
     * or of the argument values.
     *
     * @param offset
     * @param length
     */
    getDataView(offset?: number, length?: number): DataView {
      return new DataView(this.arrayBuffer, offset || this.offset, length || this.length);
    }

    /**
     *
     * Returns an ArrayBufferView for the internal buffer based on the current offset/length of this slice
     * or of the argument values.
     *
     * This might only work on Node.js or browser envs that have a Buffer constructor.
     *
     * @param offset
     * @param length
     */
    getBuffer(offset?: number, length?: number): Buffer {
      if (!Buffer) {
        throw new Error('`Buffer` is not supported as built-in class')
      }
      return Buffer.from(this.arrayBuffer, offset || this.offset, length || this.length);
    }
}

export type BufferSlices = BufferSlice[];
