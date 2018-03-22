import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

import { ISOFile, ISOBox } from './mp4/isoboxer-types';

import {getLogger} from '../logger'

const {log} = getLogger('MP4DemuxProcessor')

export class MP4DemuxProcessor extends Processor {
    constructor() {
        super();
        this.createInput()
    }

    templateSocketDescriptor(st: SocketType): SocketDescriptor {
      return new SocketDescriptor()
    }

    protected processTransfer_(inS: InputSocket, p: Packet) {
      return true
    }
}
