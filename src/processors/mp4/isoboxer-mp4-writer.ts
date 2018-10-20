import { ISOFile, ISOBox } from './isoboxer-types';

const ISOBoxer = require('codem-isoboxer');

export class IB_MP4Writer {
  static createBlankFile (): ISOFile {
    return ISOBoxer.createFile();
  }

  static createFileFromBoxes (isoBoxes: ISOBox[]): ISOFile {
    const newFile = IB_MP4Writer.createBlankFile();
    newFile.boxes.push(...isoBoxes);
    return newFile;
  }

  /**
   *
  type
  parent
  pos Position of box in parent container sub-boxes. Use `null` to append before end of parent container
  full
   */
  static createBox (type: string, parent: ISOBox | ISOFile, pos: number = null, full?: boolean): ISOBox {
    if (full) {
      return ISOBoxer.createFullBox(type, parent, pos);
    } else {
      return ISOBoxer.createBox(type, parent, pos);
    }
  }

  static writeFile (isoFile: ISOFile): ArrayBuffer {
    return isoFile.write();
  }

  static writeBoxes (isoBoxes: ISOBox[]): ArrayBuffer {
    const newFile = IB_MP4Writer.createBlankFile();
    newFile.boxes.push(...isoBoxes);
    return newFile.write();
  }
}
