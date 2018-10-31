import { Processor } from '../core/processor';

import { createMpegTSDemuxer, TSTrack, Frame } from '../ext-mod/inspector.js/src';

import { SocketDescriptor, SocketType, InputSocket, OutputSocket } from '../core/socket';
import { Packet } from '../core/packet';

import { forEachOwnPropKeyInObject, dispatchAsyncTask } from '../common-utils';
import { BufferProperties, BufferSlice } from '../core/buffer';

import { getLogger } from '../logger';
import { PayloadDescriptor, PayloadCodec } from '../core/payload-description';

const { log } = getLogger('MPEGTSDemuxProcessor');

export class MPEGTSDemuxProcessor extends Processor {

  private _programMap: {[pid: number]: OutputSocket} = {};

  private _haveAudio: boolean = false;
  private _haveVideo: boolean = false;

  constructor () {
    super();
    this.createInput();
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return new SocketDescriptor();
  }

  protected onWorkerMessage (event: Event) {
    //log('worker message', event)

    const p = Packet.fromTransferable((event as any).data.packet);

    if (p.isSymbolic()) {
      this.out.forEach((os) => os.transfer(p));
      return;
    }

    this.processDemuxerOutputPacket(p);

  }

  private processDemuxerOutputPacket(p: Packet) {

    const bs = p.data[0];

    if (!this._haveVideo && PayloadCodec.isAvc(bs.props.codec)) {
      this._haveVideo = true;
    } else if (!this._haveAudio && PayloadCodec.isAac(bs.props.codec)) {
      this._haveAudio = true;
    }

    // set mpeg-ts timescale of 90000khz
    p.setTimescale(90000);

    this.getOutput(bs.props).transfer(p);
  }

  private getOutput(payloadDescriptor: PayloadDescriptor): OutputSocket {
    const pid = payloadDescriptor.elementaryStreamId;
    if (this._programMap[pid]) {
      return this._programMap[pid];
    }
    log('creating new output for stream-id (PID):', pid, 'with codec:', payloadDescriptor.codec);
    const s = this._programMap[pid] = this.createOutput(new SocketDescriptor([payloadDescriptor]));
    return s;
  }

  protected processTransfer_ (inS: InputSocket, p: Packet) {

    // dispatchAsyncTask(this.processPacket_.bind(this, p))

    this.dispatchWorkerTask('tsdemuxer', p);

    return true;
  }

  //* /

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
  // */
}
