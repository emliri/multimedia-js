// const ISOBoxer = require('codem-isoboxer')

import * as ISOBoxer from '../../ext-mod/codem-isoboxer/dist/iso_boxer';

import { ISOFile, ISOBox } from './isoboxer-types';

export class IB_MP4Parser {
  static parse (data: Uint8Array): ISOFile {
    const res: ISOFile = ISOBoxer.parseBuffer(data.buffer);
    return res;
  }

  static findSubBoxes (box: ISOBox, type: string): ISOBox[] {
    const results: ISOBox[] = [];
    const traverse = (box: ISOBox) => {
      if (!box.boxes) {
        return;
      }
      box.boxes.forEach((subBox) => {
        if (subBox.type === type) {
          results.push(subBox);
        } else {
          traverse(subBox);
        }
      });
    };
    traverse(box);
    return results;
  }
}
