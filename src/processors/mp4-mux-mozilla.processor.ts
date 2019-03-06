import { Processor, ProcessorEvent, ProcessorEventData } from '../core/processor';
import { Packet, PacketSymbol } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType, SocketTemplateGenerator } from '../core/socket';

// This version of our mp4-mux processor is based on the mozilla rtmpjs code
import {
  MP4Mux,
  MP4Track,
  MP4Metadata,
  MP4MuxPacketType,
  MP3_SOUND_CODEC_ID,
  AAC_SOUND_CODEC_ID,
  AVC_VIDEO_CODEC_ID,
  VP6_VIDEO_CODEC_ID,
  AAC_SAMPLES_PER_FRAME
} from './mozilla-rtmpjs/mp4mux';

import { isNumber } from '../common-utils';
import { getLogger, LoggerLevel } from '../logger';

const { log, debug, warn } = getLogger('MP4MuxProcessor', LoggerLevel.ERROR);

function getCodecId (codec: MP4MuxProcessorSupportedCodecs): number {
  switch (codec) {
  case MP4MuxProcessorSupportedCodecs.AAC:
    return AAC_SOUND_CODEC_ID;
  case MP4MuxProcessorSupportedCodecs.MP3:
    return MP3_SOUND_CODEC_ID;
  case MP4MuxProcessorSupportedCodecs.AVC:
    return AVC_VIDEO_CODEC_ID;
  case MP4MuxProcessorSupportedCodecs.VP6:
    return VP6_VIDEO_CODEC_ID;
  }
}

function isVideoCodec (codec: MP4MuxProcessorSupportedCodecs): boolean {
  switch (codec) {
  case MP4MuxProcessorSupportedCodecs.AAC:
  case MP4MuxProcessorSupportedCodecs.MP3:
    return false;
  case MP4MuxProcessorSupportedCodecs.AVC:
  case MP4MuxProcessorSupportedCodecs.VP6:
    return true;
  }
}

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mp4', 'video/mp4')); // possible output

export enum MP4MuxProcessorSupportedCodecs {
  AVC = 'avc',
  AAC = 'mp4a',
  MP3 = 'mp3',
  VP6 = 'vp6f'
}

const FORCE_MP3 = false;

export class MP4MuxProcessor extends Processor {
  static getName (): string {
    return 'MP4MuxProcessor';
  }

  private hasBeenClosed_: boolean = false;
  private mp4Muxer_: MP4Mux = null;
  private mp4Metadata_: MP4Metadata = null;
  private keyFramePushed_: boolean = false;
  private lastCodecInfo_: string[] = [];
  private flushCounter_: number = 0;

  private videoPacketQueue_: Packet[] = [];
  private audioPacketQueue_: Packet[] = [];
  private socketToTrackIndexMap_: {[i: number]: number} = {};
  // this simpler approach will restrict us to have only one audio and one video track for now
  private videoTrackIndex_: number;
  private audioTrackIndex_: number;

  constructor () {
    super();

    this.createOutput();

    this._initMP4Metadata();

    this.on(ProcessorEvent.INPUT_SOCKET_CREATED,
      (eventData: ProcessorEventData) => this._onInputCreated(eventData));
  }

  templateSocketDescriptor (st: SocketType): SocketDescriptor {
    return getSocketDescriptor(st);
  }

  protected processTransfer_ (inputSocket: InputSocket, p: Packet, inputIndex: number): boolean {
    debug(`received packet: ${p.toString()}; on input: ${inputIndex}`);

    if (!p.defaultPayloadInfo) {
      warn('no default payload info:', p);
      return false;
    }

    if (p.defaultPayloadInfo.isAudio()) {
      this.audioPacketQueue_.push(p);

      if (this.mp4Metadata_.tracks[this.socketToTrackIndexMap_[inputIndex]]) {
        return true;
      }

      this.audioTrackIndex_ =
        this.socketToTrackIndexMap_[inputIndex] =
          this.mp4Metadata_.tracks.length;

      // FIXME: get actual infos here from input packets
      this._addAudioTrack(
        FORCE_MP3 ? MP4MuxProcessorSupportedCodecs.MP3 : MP4MuxProcessorSupportedCodecs.AAC,
        p.defaultPayloadInfo.getSamplingRate(),
        p.defaultPayloadInfo.sampleDepth,
        p.defaultPayloadInfo.details.numChannels,
        p.defaultPayloadInfo.details.sequenceDurationInSeconds
      );

      return true;
    } else if (p.defaultPayloadInfo.isVideo()) {
      this.videoPacketQueue_.push(p);

      if (this.mp4Metadata_.tracks[this.socketToTrackIndexMap_[inputIndex]]) {
        return true;
      }

      this.videoTrackIndex_ =
        this.socketToTrackIndexMap_[inputIndex] =
          this.mp4Metadata_.tracks.length;

      this._addVideoTrack(
        MP4MuxProcessorSupportedCodecs.AVC,
        // FIXME: get actual infos here from input packets
        p.defaultPayloadInfo.getSamplingRate(), // fps
        p.defaultPayloadInfo.details.width,
        p.defaultPayloadInfo.details.height, // resolution
        p.defaultPayloadInfo.details.sequenceDurationInSeconds,
        p.getTimescale()
      );

      return true;
    }

    return true;
  }

  protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
    switch (symbol) {
    case PacketSymbol.RESUME:
      log('resume symbol received, closing state');
      this._close();
      break;
    case PacketSymbol.EOS:
      this.flushCounter_++;
      if (this.flushCounter_ !== this.in.length) {
        break;
      }

      log('received EOS symbols count equal to inputs width, flushing');
      this._flush();
      this.flushCounter_ = 0;
    default:
      break;
    }

    return super.handleSymbolicPacket_(symbol);
  }

  private _processVideoPacket (p: Packet) {
    const videoTrackMetadata = this.mp4Metadata_.tracks[this.videoTrackIndex_];
    const timescale = videoTrackMetadata.timescale;

    p.forEachBufferSlice((bufferSlice) => {
      const mp4Muxer = this.mp4Muxer_;
      const data = bufferSlice.getUint8Array();

      if (bufferSlice.props.isBitstreamHeader) {
        log('got bitstream header at:', p.toString());
      } else {
        debug('video packet:', p.toString());
      }

      if (bufferSlice.props.isKeyframe) {
        log('got keyframe at:', p.toString());
      }

      mp4Muxer.pushPacket(
        MP4MuxPacketType.VIDEO_PACKET,
        AVC_VIDEO_CODEC_ID,
        data,
        p.getScaledDts(timescale),
        true,
        bufferSlice.props.isBitstreamHeader,
        bufferSlice.props.isKeyframe,
        p.getScaledCto(timescale)
      );

      if (!this.keyFramePushed_ &&
        bufferSlice.props.isKeyframe) {
        this.keyFramePushed_ = true;
      }
    });
  }

  private _processAudioPacket (p: Packet) {
    const audioTrackMetadata = this.mp4Metadata_.tracks[this.audioTrackIndex_];
    const timescale = audioTrackMetadata.timescale;

    const audioDetails = {
      sampleDepth: audioTrackMetadata.samplesize,
      sampleRate: audioTrackMetadata.samplerate,
      samplesPerFrame: AAC_SAMPLES_PER_FRAME,
      numChannels: audioTrackMetadata.channels
    };

    p.forEachBufferSlice((bufferSlice) => {
      const mp4Muxer = this.mp4Muxer_;
      const data = bufferSlice.getUint8Array();

      if (bufferSlice.props.isBitstreamHeader) {
        log('got audio codec init data');
      }

      debug('audio packet:', p.toString());

      mp4Muxer.pushPacket(
        MP4MuxPacketType.AUDIO_PACKET,
        FORCE_MP3 ? MP3_SOUND_CODEC_ID : AAC_SOUND_CODEC_ID,
        data,
        p.getScaledDts(timescale),
        true,
        bufferSlice.props.isBitstreamHeader,
        bufferSlice.props.isKeyframe,
        p.getScaledCto(timescale),
        audioDetails
      );

      if (!this.keyFramePushed_ &&
        bufferSlice.props.isKeyframe) {
        this.keyFramePushed_ = true;
      }
    });
  }

  private _onInputCreated (eventData: ProcessorEventData) {
    log('input socket created');
  }

  private _initMP4Metadata () {
    this.mp4Metadata_ = {
      tracks: [],
      duration: 0,
      audioTrackId: NaN,
      videoTrackId: NaN
    };
  }

  private _initMuxer () {
    log('initMuxer() called with mp4 metadata model:', this.mp4Metadata_);

    const mp4Muxer = this.mp4Muxer_ = new MP4Mux(this.mp4Metadata_, false);

    mp4Muxer.ondata = this.onMp4MuxerData_.bind(this);
    mp4Muxer.oncodecinfo = this.onMp4MuxerCodecInfo_.bind(this);

    this.hasBeenClosed_ = true;
  }

  private _getNextTrackId (): number {
    return (this.mp4Metadata_.tracks.length + 1);
  }

  private _close () {
    log('closing state');
    if (!this.hasBeenClosed_) {
      this._initMuxer();
    }

    log('processing video packet queue', this.videoPacketQueue_);

    this.videoPacketQueue_.forEach((packet: Packet) => {
      this._processVideoPacket(packet);
    });
    this.videoPacketQueue_ = [];

    this.audioPacketQueue_.forEach((packet: Packet) => {
      this._processAudioPacket(packet);
    });
    this.audioPacketQueue_ = [];
  }

  private _flush () {
    log('flush called');
    this._close();
    log('will flush internal muxer engine');
    this.mp4Muxer_.flush();
  }

  private _addAudioTrack (
    audioCodec: MP4MuxProcessorSupportedCodecs,
    sampleRate: number,
    sampleSize: number,
    numChannels: number,
    durationSeconds: number,
    language: string = 'und'): MP4Track {
    if (isVideoCodec(audioCodec)) {
      throw new Error('Not an audio codec: ' + audioCodec);
    }

    let audioTrack: MP4Track = {
      duration: durationSeconds >= 0 ? durationSeconds * sampleRate : -1,
      codecDescription: audioCodec,
      codecId: getCodecId(audioCodec),
      language: language,
      timescale: sampleRate,
      samplerate: sampleRate,
      channels: numChannels,
      samplesize: sampleSize
    };

    log('creating audio track:', audioCodec);

    this.mp4Metadata_.audioTrackId = this._getNextTrackId();
    this.mp4Metadata_.tracks.push(audioTrack);

    return audioTrack;
  }

  private _addVideoTrack (
    videoCodec: MP4MuxProcessorSupportedCodecs,
    framerate: number,
    width: number,
    height: number,
    durationSeconds: number,
    timescale: number = framerate
  ): MP4Track {
    if (!isVideoCodec(videoCodec)) {
      throw new Error('Not a video codec: ' + videoCodec);
    }

    let videoTrack: MP4Track = {
      duration: durationSeconds >= 0 ? durationSeconds * timescale : -1,
      codecDescription: videoCodec,
      codecId: getCodecId(videoCodec),
      timescale,
      framerate,
      width,
      height,
      language: 'und'
    };

    log('creating video track:', videoCodec);

    this.mp4Metadata_.videoTrackId = this._getNextTrackId();
    this.mp4Metadata_.tracks.push(videoTrack);

    if (!isNumber(this.mp4Metadata_.duration) && isNumber(videoTrack.duration)) {
      this.mp4Metadata_.duration = videoTrack.duration;
      log('set top-level metadata duration based on video-track:', this.mp4Metadata_.duration);
    }

    return videoTrack;
  }

  private onMp4MuxerData_ (data: Uint8Array) {
    const p: Packet = Packet.fromArrayBuffer(data.buffer, 'video/mp4; codecs="avc1.64001f,mp4a.40.2"');

    log('transferring new mp4 data:', p);

    this.out[0].transfer(p);
  }

  private onMp4MuxerCodecInfo_ (codecInfo: string[]) {
    log('got new codec info:', codecInfo);

    this.lastCodecInfo_ = codecInfo;
  }
}
