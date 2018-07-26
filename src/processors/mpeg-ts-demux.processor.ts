import { Processor } from "../core/processor";

import {createMpegTSDemuxer, TSTrack, Frame} from '../ext-mod/inspector.js/src';

import * as Thumbcoil from '../ext-mod/thumbcoil/dist/thumbcoil'

import { SocketDescriptor, SocketType, InputSocket, OutputSocket } from "../core/socket";
import { Packet } from "../core/packet";

import {forEachOwnPropKeyInObject} from "../common-utils"
import { BufferProperties } from "../core/buffer";

export class MPEGTSDemuxProcessor extends Processor {

  private _tsDemux = createMpegTSDemuxer();

  private _onCreateOutput: (out: OutputSocket) => void;

  private _haveAudio: boolean = false;
  private _haveVideo: boolean = false;

  constructor() {
    super();
    this.createInput()
  }

  templateSocketDescriptor(socketType: SocketType): SocketDescriptor {
    return new SocketDescriptor()
  }

  ///*
  protected processTransfer_(inS: InputSocket, p: Packet) {

    if (this.out.length === 0) {
      this.createOutput();
    }

    p.forEachBufferSlice((bufferSlice) => {
      const result = Thumbcoil.tsInspector.inspect(bufferSlice.getUint8Array())

      console.log(result)
    })

    return true;
  }

  //*/

  // Using inspector.js - FIXME: has bugs with byte offset that need to be fixed in inspector.js,
  // but is tricky as the whole TS-parsing drops context and we would need to dive into that
  // or make plain copies in there and pass them out somehow, which would be ugly
  /*
  protected processTransfer_(inS: InputSocket, p: Packet) {

    if (this.out.length === 0) {
      this.createOutput();
    }

    p.forEachBufferSlice((bufferSlice) => {
      this._tsDemux.append(bufferSlice.getUint8Array());
      this._tsDemux.end();

      console.log(this._tsDemux.tracks);

      forEachOwnPropKeyInObject(this._tsDemux.tracks, (track: TSTrack) => {

        if (track.type === 'audio') {
          return;
        }

        if (track.type === 'video' && !this._haveVideo) {
          this._haveVideo = true;
          this.createOutput();
        }

        const props: BufferProperties = new BufferProperties(
          track.mimeType,
          1 / 60,
          NaN,
          1
        );

        track.getFrames().forEach((frame: Frame) => {
          console.log(frame);

          const frameSlice = bufferSlice.unwrap(
            frame.bytesOffset,
            frame.size,
            props
          );

          //console.log(frame.size);

          const p: Packet = Packet.fromSlice(frameSlice);

          // timestamps of this packet
          p.timestamp = frame.getDecodingTimestampInSeconds();
          p.presentationTimeOffset = frame.getPresentationTimestampInSeconds() - frame.getDecodingTimestampInSeconds();

          console.log(p)

          //console.log(frame.bytesOffset, frame.size);

          this.out[0].transfer(p)

        })
      });

    })

    return true;
  }
  //*/

}
