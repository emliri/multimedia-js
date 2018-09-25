import { Processor } from "../core/processor";
import { InputSocket, SocketDescriptor, SocketType } from "../core/socket";
import { Packet } from "../core/packet";

import {Fmp4Remuxer, Fmp4RemuxerEvent, Fmp4RemuxerConfig,
  Fmp4RemuxerAudioTrack,
  Fmp4RemuxerVideoTrack,
  Fmp4RemuxerId3Track,
  Fmp4RemuxerTextTrack
} from './hlsjs-fmp4-mux/mp4-remuxer';

import { BufferSlice } from "../core/buffer";

const config: Fmp4RemuxerConfig = {
  maxBufferHole: 1.5,
  maxAudioFramesDrift: 2,
  stretchShortVideoTrack: false
}

export class MP4MuxHlsjsProcessor extends Processor {
  private fmp4Remux: Fmp4Remuxer = new Fmp4Remuxer(
    this._onFmp4Event.bind(this),
    config,
    {}
  );

  private videoTrack: Fmp4RemuxerVideoTrack = {
    samples: [],
    inputTimeScale: 1,
    timescale: 12800,
    sps: null,
    pps: null,
    codec: null,
    width: 0,
    height: 0,
    dropped: 0,
    len: 0,
    nbNalu: 0,
    sequenceNumber: 0
  };

  private audioTrack: Fmp4RemuxerAudioTrack;

  constructor() {
    super();
  }

  templateSocketDescriptor(st: SocketType): SocketDescriptor {
    return new SocketDescriptor()
  }

  protected processTransfer_(inS: InputSocket, p: Packet) {

    p.forEachBufferSlice((bufferSlice: BufferSlice) => {

      this.videoTrack.samples.push({
        pts: p.getPresentationTime(),
        dts: p.timestamp,
        length: 1,
        id: 0,
        units: [],
        key: 0
      })

    })
    return true;
  }

  private _onFmp4Event(event: Fmp4RemuxerEvent, data: any) {
    //console.log('fmp4remux >', event, data);
  }

  public flush() {
    this.fmp4Remux.remux(this.audioTrack, this.videoTrack, null, null, 0, true, true);
  }
}
