import { Processor } from "../core/processor";

import {createMpegTSDemuxer, Track, Frame} from '../ext-mod/inspector.js/src';

import { SocketDescriptor, SocketType, InputSocket, OutputSocket } from "../core/socket";
import { Packet } from "../core/packet";

import {forEachOwnPropKeyInObject} from "../common-utils"

export class MPEGTSDemuxProcessor extends Processor {

  private _tsDemux = createMpegTSDemuxer();

  private _onCreateOutput: (out: OutputSocket) => void;

  constructor() {
    super();
    this.createInput()
  }

  templateSocketDescriptor(socketType: SocketType): SocketDescriptor {
    return new SocketDescriptor()
  }

  protected processTransfer_(inS: InputSocket, p: Packet) {

    p.forEachBufferSlice((bufferSlice) => {
      this._tsDemux.append(bufferSlice.getUint8Array());
      this._tsDemux.end();

      forEachOwnPropKeyInObject(this._tsDemux.tracks, (t: Track) => {
        t.getFrames().forEach((f: Frame) => {
          console.log(f);
        })
      });
    })

    return true;
  }

}
