import {Processor} from '../core/processor';
import {Packet, PacketSymbol} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

// This version of our mp4-mux processor is based on the mozilla rtmpjs code
import {
  MP4Mux,
  MP4Track,
  MP4Metadata,
  AUDIO_PACKET,
  VIDEO_PACKET,
  MP3_SOUND_CODEC_ID,
  AAC_SOUND_CODEC_ID,
  AVC_VIDEO_CODEC_ID,
  VP6_VIDEO_CODEC_ID
} from './mozilla-rtmpjs/mp4mux'
import { isNumber } from '../common-utils';

// import {MP4Writer} from './mp4/mp4-writer'

export enum MP4MuxProcessorSupportedCodecs {
  AVC = 'avc',
  AAC = 'mp4a',
  MP3 = 'mp3',
  VP6 = 'vp6f'
}

function getCodecId(codec: MP4MuxProcessorSupportedCodecs): number {
  switch (codec) {
  case MP4MuxProcessorSupportedCodecs.AAC:
    return AAC_SOUND_CODEC_ID
  case MP4MuxProcessorSupportedCodecs.MP3:
    return MP3_SOUND_CODEC_ID
  case MP4MuxProcessorSupportedCodecs.AVC:
    return AVC_VIDEO_CODEC_ID
  case MP4MuxProcessorSupportedCodecs.VP6:
    return VP6_VIDEO_CODEC_ID
  }
}

function isVideoCodec(codec: MP4MuxProcessorSupportedCodecs): boolean {
  switch (codec) {
  case MP4MuxProcessorSupportedCodecs.AAC:
  case MP4MuxProcessorSupportedCodecs.MP3:
    return false
  case MP4MuxProcessorSupportedCodecs.AVC:
  case MP4MuxProcessorSupportedCodecs.VP6:
    return true
  }
}

const VIDEO_TRACK_DEFAULT_TIMESCALE = 12800;

export class MP4MuxProcessor extends Processor {

  private mp4Muxer_: MP4Mux = null;
  private mp4Metadata_: MP4Metadata = null;
  private closed_: boolean = false;
  private keyFramePushed_: boolean = false;
  private lastCodecInfo_: string[];

  constructor() {
    super();

    this.createOutput()
    this.initMP4Metadata()
  }

  private initMP4Metadata() {
    const mp4Metadata: MP4Metadata = this.mp4Metadata_ = {
      tracks: [],
      duration: 0,
      audioTrackId: NaN,
      videoTrackId: NaN
    }
  }

  private initMuxer() {
    console.log('initMuxer', this.mp4Metadata_)

    const mp4Muxer = this.mp4Muxer_ = new MP4Mux(this.mp4Metadata_)

    mp4Muxer.ondata = this.onMp4MuxerData_.bind(this)
    mp4Muxer.oncodecinfo = this.onMp4MuxerCodecInfo_.bind(this)

    this.closed_ = true;
  }

  private getNextTrackId(): number {
    return (this.mp4Metadata_.tracks.length + 1);
  }

  isClosed(): boolean {
    return this.closed_
  }

  close() {
    if (!this.isClosed()) {
      this.initMuxer()
    }
  }

  addAudioTrack(audioCodec: MP4MuxProcessorSupportedCodecs,
    sampleRate?: number, numChannels?: number, language?: string, duration?: number): InputSocket {

    if (isVideoCodec(audioCodec)) {
      throw new Error('Not an audio codec: ' + audioCodec)
    }

    const s = this.createInput()

    var audioTrack: MP4Track = {
      duration: isNumber(duration) ? duration : -1,
      codecDescription: audioCodec,
      codecId: getCodecId(audioCodec),
      language: language || 'und',
      timescale: sampleRate || 44100,
      samplerate: sampleRate || 44100,
      channels: numChannels || 2,
      samplesize: 16
    };

    this.mp4Metadata_.audioTrackId = this.getNextTrackId();
    this.mp4Metadata_.tracks.push(audioTrack)

    return s;
  }

  addVideoTrack(
    videoCodec: MP4MuxProcessorSupportedCodecs,
    frameRate: number, width: number, height: number, duration?: number): InputSocket {

    if (!isVideoCodec(videoCodec)) {
      throw new Error('Not a video codec: ' + videoCodec)
    }

    const s = this.createInput()

    var videoTrack: MP4Track = {
      duration: isNumber(duration) ? duration * VIDEO_TRACK_DEFAULT_TIMESCALE : -1,
      codecDescription: videoCodec,
      codecId: getCodecId(videoCodec),
      language: 'und',
      timescale: VIDEO_TRACK_DEFAULT_TIMESCALE,
      framerate: frameRate,
      width: width,
      height: height
    };

    console.log('created video track:', videoTrack)

    this.mp4Metadata_.videoTrackId = this.getNextTrackId();
    this.mp4Metadata_.tracks.push(videoTrack);

    if (isNumber(duration)) {
      this.mp4Metadata_.duration = duration * VIDEO_TRACK_DEFAULT_TIMESCALE;

      console.log('set duration:', this.mp4Metadata_.duration)
    }

    return s;
  }

  getCodecInfo(): string[] {
    return this.lastCodecInfo_;
  }

  flush() {
    this.close()
    this.mp4Muxer_.flush()
  }

  templateSocketDescriptor(st: SocketType): SocketDescriptor {
    return new SocketDescriptor()
  }

  protected processTransfer_(inS: InputSocket, p: Packet) {
    this.close()

    p.forEachBufferSlice((bufferSlice) => {
      const mp4Muxer = this.mp4Muxer_;
      const data = bufferSlice.getUint8Array();

      if (this.keyFramePushed_ && bufferSlice.props.isKeyframe) {
        this.flush();
      }

      if (bufferSlice.props.isBitstreamHeader) {
        console.log('Got codec init data');
      }

      mp4Muxer.pushPacket(VIDEO_PACKET,
        data,
        p.timestamp * VIDEO_TRACK_DEFAULT_TIMESCALE,
        true,
        bufferSlice.props.isBitstreamHeader,
        bufferSlice.props.isKeyframe,
        p.presentationTimeOffset * VIDEO_TRACK_DEFAULT_TIMESCALE,
      );

      if (!this.keyFramePushed_
        && bufferSlice.props.isKeyframe) {
        this.keyFramePushed_ = true;
      }
    })

    return true
  }

  protected handleSymbolicPacket_(symbol: PacketSymbol) {
    switch (symbol) {
    case PacketSymbol.EOS:
      console.log('received EOS');
      this.flush();
      return false;
    default:
      super.handleSymbolicPacket_(symbol);
    }
  }

  private onMp4MuxerData_(data: Uint8Array) {
    const p: Packet = Packet.fromArrayBuffer(data.buffer)

    console.log('fmp4 data:', p)

    this.out[0].transfer(p)
  }

  private onMp4MuxerCodecInfo_(codecInfo: string[]) {
    console.log('codec info:', codecInfo)

    this.lastCodecInfo_ = codecInfo;
  }
}
