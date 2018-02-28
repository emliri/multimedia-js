import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

import {MP3Parser} from './mp3/mp3-parser'

export class MP3ParseProcessor extends Processor {

    constructor() {
        super();
    }

    templateSocketDescriptor(st: SocketType): SocketDescriptor {
      return new SocketDescriptor()
    }

    protected processTransfer_(inS: InputSocket, p: Packet) {
      return true
    }

}
