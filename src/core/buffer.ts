import {PayloadDescriptor} from './mime-type';

export class BufferProperties extends PayloadDescriptor {

    mediaKey: any;
    params: Object;
    samplesCount: number;
    timestampDelta: number;

    constructor(mimeType, sampleDuration) {
        super(mimeType);

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

    constructor(arrayBuffer: ArrayBuffer, offset: number, length: number, props) {
        this.arrayBuffer = arrayBuffer;

        if(offset < 0 || length < 0) {
            throw new Error('Illegal parameters for BufferSlice window');
        }

        this.offset = offset;
        this.length = length;

        this.props = props;
    }

    getDataView() : DataView {
        return new DataView(this.arrayBuffer, this.offset, this.length);
    }

    getUint8() {

    }
}

export type BufferSlices = BufferSlice[];
