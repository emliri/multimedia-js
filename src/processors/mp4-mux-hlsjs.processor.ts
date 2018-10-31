import { Processor } from '../core/processor';
import { InputSocket, SocketDescriptor, SocketType } from '../core/socket';
import { Packet, PacketSymbol } from '../core/packet';

import {
  Fmp4Remuxer,
  Fmp4RemuxerEvent,
  Fmp4RemuxerConfig,
  Fmp4RemuxerAudioTrack,
  Fmp4RemuxerVideoTrack
} from './hlsjs-fmp4-mux/mp4-remuxer';

import { BufferSlice } from '../core/buffer';
import { getLogger } from '../logger';
import { PayloadCodec } from '../core/payload-description';

const { log } = getLogger('MP4MuxHlsjsProcessor');

const config: Fmp4RemuxerConfig = {
  maxBufferHole: 1.5,
  maxAudioFramesDrift: 2,
  stretchShortVideoTrack: false
};

export class MP4MuxHlsjsProcessor extends Processor {
  private _fmp4Remux: Fmp4Remuxer = new Fmp4Remuxer(
    this._onFmp4Event.bind(this),
    config,
    {}
  );

  private _videoTrack: Fmp4RemuxerVideoTrack = {
    duration: 10,
    samples: [],
    inputTimeScale: 90000,
    timescale: 90000,
    sps: null,
    pps: null,
    codec: null,
    width: 0,
    height: 0,
    dropped: 0,
    len: 0,
    nbNalu: 0,
    sequenceNumber: 1,
    type: 'video',
    pixelRatio: [1, 1],
    id: 1
  };

  private _videoTrackPacketIndex: number = 0;
  private _audioTrackPacketIndex: number = 0;

  private _flushSymbolCnt: number = 0;

  private _audioTrack: Fmp4RemuxerAudioTrack = {
    id: 2,
    duration: 10,
    codec: null,
    timescale: 90000,
    samples: [],
    config: null,
    samplerate: 44100,
    isAAC: true,
    channelCount: 2,
    inputTimeScale: 90000,
    len: 0,
    nbNalu: 0,
    sequenceNumber: 0,
    type: 'audio',
    manifestCodec: null
  }

  constructor () {
    super();
    this.createOutput();
  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return new SocketDescriptor();
  }

  protected processTransfer_ (inS: InputSocket, p: Packet) {

    p.forEachBufferSlice((bufferSlice: BufferSlice) => {

      const {codec} = bufferSlice.props;

      if (PayloadCodec.isAvc(codec)) {

        if (bufferSlice.props.isBitstreamHeader) {
          // note: per spec, sps/pps can be several buffers
          if (bufferSlice.props.tags.has('sps')) {
            this._videoTrack.sps = [bufferSlice.getUint8Array()];
          } else if (bufferSlice.props.tags.has('pps')) {
            this._videoTrack.pps = [bufferSlice.getUint8Array()];
          }

          this._videoTrack.width = bufferSlice.props.details.width;
          this._videoTrack.height = bufferSlice.props.details.height;
          this._videoTrack.codec = bufferSlice.props.codec;

          return;
        }

        this._videoTrack.samples.push({
          pts: p.getPresentationTimestamp(),
          dts: p.timestamp,
          length: 1,
          id: this._videoTrackPacketIndex,
          units: [{ data: bufferSlice.getUint8Array() }],
          key: bufferSlice.props.isKeyframe
        });
        //this._videoTrack.len++; // FIXME

        this._videoTrackPacketIndex++;

      } else if (PayloadCodec.isAac(codec)) {

        //log(p, bufferSlice);

        this._audioTrack.codec = codec;
        this._audioTrack.manifestCodec = codec;
        this._audioTrack.config = <number[]> bufferSlice.props.details.codecConfigurationData;

        this._audioTrack.samples.push({
          pts: p.getPresentationTimestamp(),
          dts: p.timestamp,
          length: 1,
          id: this._audioTrackPacketIndex,
          units: [{ data: bufferSlice.getUint8Array() }],
          key: bufferSlice.props.isKeyframe
        });
        this._audioTrack.len += bufferSlice.length; // FIXME

        this._audioTrackPacketIndex++;

      } else if (true /* TODO: support mp3/mpegaudio */) {

        this._audioTrack.isAAC = false;

      }

    });

    return true;
  }

  /**
   * @override
  symbol
   */
  protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {

    if (symbol === PacketSymbol.FLUSH) {

      this._flushSymbolCnt++;

      log('received flush symbol');

      if (this._flushSymbolCnt === this.in.length) {
        this._flushSymbolCnt = 0;
        this._flush();
      }
    }

    return false;
    // return super.handleSymbolicPacket_(symbol);
  }

  private _onFmp4Event (event: Fmp4RemuxerEvent, data: any) {
    log('fmp4remux event >', event, data);

    switch (event) {
    case Fmp4RemuxerEvent.INIT_PTS_FOUND:
      break;
    case Fmp4RemuxerEvent.FRAG_PARSING_INIT_SEGMENT: {

      const {tracks: { audio, video }} = data;

      if (audio) {
        //this.out[0].transfer(Packet.fromSlice(BufferSlice.fromTypedArray(audio.initSegment)));
      }

      if (video) {
        this.out[0].transfer(Packet.fromSlice(BufferSlice.fromTypedArray(video.initSegment)));
      }

      break;
    }
    case Fmp4RemuxerEvent.FRAG_PARSING_DATA: {
      const { data1, data2 } = data;
      if (data.type === 'video') {
        this.out[0].transfer(Packet.fromSlice(BufferSlice.fromTypedArray(data1)));
        this.out[0].transfer(Packet.fromSlice(BufferSlice.fromTypedArray(data2)));
      }
      else if (data.type === 'audio') {

      }
      break;
    }
    }
  }

  private _flush () {
    if (this._videoTrackPacketIndex === 0) {
      return;
    }
    log('flushing at a/v packets:', this._videoTrackPacketIndex, this._audioTrackPacketIndex);
    this._fmp4Remux.process(this._audioTrack, this._videoTrack, null, null, 0, true, true);
  }
}
