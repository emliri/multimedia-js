import { Processor } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';

import { IB_MP4Parser } from './isoboxer/isoboxer-mp4-parser';
import { ISOFile } from './isoboxer/isoboxer-types';

import { getLogger } from '../logger';

const { log } = getLogger('CodemIsoboxerMP4DemuxProcessor');

export class IsoboxerMP4SliceProcessor extends Processor {

  static getName(): string { return "IsoboxerMP4SliceProcessor" }

  constructor () {
    super();
    this.createInput();
  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return new SocketDescriptor();
  }

  protected processTransfer_ (inS: InputSocket, p: Packet) {
    p.data.forEach((bufferSlice) => {
      const isoFile: ISOFile = IB_MP4Parser.parse(bufferSlice.getUint8Array());
      const movie = isoFile.fetchAll('moov');

      const fragments = isoFile.fetchAll('moof');

      console.log(fragments);
    });

    return true;
  }
}
