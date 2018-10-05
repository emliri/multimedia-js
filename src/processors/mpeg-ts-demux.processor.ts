import { Processor } from "../core/processor";

import {createMpegTSDemuxer, TSTrack, Frame} from '../ext-mod/inspector.js/src';

import { SocketDescriptor, SocketType, InputSocket, OutputSocket } from "../core/socket";
import { Packet } from "../core/packet";

import {forEachOwnPropKeyInObject, dispatchAsyncTask} from "../common-utils"
import { BufferProperties, BufferSlice } from "../core/buffer";

import {getLogger} from '../logger';

const {log} = getLogger('MPEGTSDemuxProcessor')

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

  protected onWorkerMessage(event: Event) {
    //log('worker message', event)

    const p = Packet.fromTransferable((event as any).data.packet);

    this.out[0].transfer(p);
  }

  /*
  private processPacket_(p: Packet) {
    p.forEachBufferSlice((bufferSlice) => {
      const parsedData = Thumbcoil.tsInspector.inspect(bufferSlice.getUint8Array())
      Thumbcoil.tsInspector.domify(parsedData)
      console.log(parsedData)
    });
  }
  */


  ///*
  protected processTransfer_(inS: InputSocket, p: Packet) {

    if (this.out.length === 0) {
      this.createOutput();
    }

    //dispatchAsyncTask(this.processPacket_.bind(this, p))

    this.dispatchWorkerTask('tsdemuxer', p);

    return true;
  }

  //*/

  // Using inspector.js - FIXME: need to write copies of ES NALUs
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
