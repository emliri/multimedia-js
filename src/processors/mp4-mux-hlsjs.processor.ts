import { Processor } from '../core/processor';
import { InputSocket, SocketDescriptor, SocketType, SocketTemplateGenerator } from '../core/socket';
import { Packet, PacketSymbol } from '../core/packet';

import {
  Fmp4Remuxer,
  Fmp4RemuxerEvent,
  Fmp4RemuxerConfig,
  Fmp4RemuxerAudioTrack,
  Fmp4RemuxerVideoTrack,
  Fmp4RemuxerTrackState,
  Fmp4RemuxerPayloadSegmentData
} from './hlsjs-fmp4-mux/mp4-remuxer';

import { BufferSlice, BufferProperties } from '../core/buffer';
import { getLogger } from '../logger';
import { PayloadCodec } from '../core/payload-description';
import { Socket } from 'dgram';

const { log } = getLogger('MP4MuxHlsjsProcessor');

const config: Fmp4RemuxerConfig = {
  maxBufferHole: 1.5,
  maxAudioFramesDrift: 2,
  stretchShortVideoTrack: false
};

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
      SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac'), // valid inputs
      SocketDescriptor.fromMimeTypes('audio/mp4', 'video/mp4')); // possible output

export class MP4MuxHlsjsProcessor extends Processor {

  private _fmp4Remux: Fmp4Remuxer = new Fmp4Remuxer(
    this._onFmp4Event.bind(this),
    config
  );

  private _videoTrack: Fmp4RemuxerVideoTrack = {
    type: 'video',
    id: 1,
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
    sequenceNumber: 1,
    pixelRatio: [1, 1],

    len: 0,
    nbNalu: 0
  };

  private _audioTrack: Fmp4RemuxerAudioTrack = {
    type: 'audio',
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
    sequenceNumber: 0,
    manifestCodec: null,

    len: 0,
    nbNalu: 0
  }

  private _videoTrackPacketIndex: number = 0;
  private _audioTrackPacketIndex: number = 0;

  private _flushSymbolCnt: number = 0;

  constructor () {
    super();
    this.createOutput();
  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return getSocketDescriptor(st);
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

  private _onFmp4Event (event: Fmp4RemuxerEvent, data) {
    switch (event) {
    case Fmp4RemuxerEvent.GOT_INIT_PTS_VALUE:
      break;
    case Fmp4RemuxerEvent.WROTE_INIT_SEGMENT: {
      const tracks: Fmp4RemuxerTrackState = data.tracks;

      if (tracks.audio) {
        log('got init data for a new audio track')

        const bs: BufferSlice = BufferSlice.fromTypedArray(tracks.audio.initSegment);
        bs.props.mimeType = tracks.audio.container;
        bs.props.codec = tracks.audio.codec;
        bs.props.details.channelCount = tracks.audio.metadata.channelCount;

        const p: Packet = Packet.fromSlice(bs);
        p.timestamp = 0;

        this.out[0].transfer(p);
      }

      if (tracks.video) {
        log('got init data for a new video track')

        const bs: BufferSlice = BufferSlice.fromTypedArray(tracks.video.initSegment);
        bs.props.mimeType = tracks.video.container;
        bs.props.codec = tracks.video.codec;
        bs.props.details.width = tracks.video.metadata.width;
        bs.props.details.height = tracks.video.metadata.height;

        const p: Packet = Packet.fromSlice(bs);
        p.timestamp = 0;

        this.out[0].transfer(p);
      }

      break;
    }
    case Fmp4RemuxerEvent.WROTE_PAYLOAD_SEGMENT: {
      const payloadSegmentData: Fmp4RemuxerPayloadSegmentData = data;

      log('got mp4 fragment-data with payload-type:', payloadSegmentData.payloadType);

      const props: BufferProperties = new BufferProperties(payloadSegmentData.payloadType + '/mp4');

      props.codec = payloadSegmentData.codec;
      props.samplesCount = payloadSegmentData.nbOfSamples;

      const moof: BufferSlice = BufferSlice.fromTypedArray(payloadSegmentData.fragmentHeader, props);
      const mdat: BufferSlice = BufferSlice.fromTypedArray(payloadSegmentData.fragmentData, props);

      const p: Packet = Packet.fromSlices(0, 0, moof, mdat);

      this.out[0].transfer(p);
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
