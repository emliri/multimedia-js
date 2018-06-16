import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
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

export class MP4MuxProcessor extends Processor {

  private mp4Muxer_: MP4Mux = null
  private mp4Metadata_: MP4Metadata = null
  private closed_: boolean = false

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
    return (this.mp4Metadata_.tracks.length);
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
    sampleRate?: number, numChannels?: number, language?: string): InputSocket {

    if (isVideoCodec(audioCodec)) {
      throw new Error('Not an audio codec: ' + audioCodec)
    }

    const s = this.createInput()

    var audioTrack: MP4Track = {
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
    frameRate: number, width: number, height: number): InputSocket {

    if (!isVideoCodec(videoCodec)) {
      throw new Error('Not a video codec: ' + videoCodec)
    }

    const s = this.createInput()

    var videoTrack: MP4Track = {
      codecDescription: videoCodec,
      codecId: getCodecId(videoCodec),
      language: 'und',
      timescale: 60000,
      framerate: frameRate,
      width: width,
      height: height
    };

    this.mp4Metadata_.videoTrackId = this.getNextTrackId();
    this.mp4Metadata_.tracks.push(videoTrack);

    return s;
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

    const mp4Muxer = this.mp4Muxer_;

    const bufferSlice = p.data[0];

    const data = bufferSlice.getUint8Array();

    console.log(data.byteLength);

    mp4Muxer.pushPacket(VIDEO_PACKET, data, p.timestamp, true, bufferSlice.props.isBitstreamHeader, p.presentationTimeOffset);

    return true
  }

  private onMp4MuxerData_(data: Uint8Array) {
    const p: Packet = Packet.fromArrayBuffer(data.buffer)

    this.out[0].transfer(p)
  }

  private onMp4MuxerCodecInfo_(codecInfo: string[]) {
    console.log(codecInfo)
  }
}
