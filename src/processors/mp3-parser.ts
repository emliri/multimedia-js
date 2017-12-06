import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket} from '../core/socket';

export class MP3Parser extends Processor {

    constructor() {
        super();
    }

    protected abstract processTransfer_(inS: InputSocket, p: Packet) {

    }

}