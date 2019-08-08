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
import { BufferSlice } from '../core/buffer';
import { makeNALUFromH264RbspData, makeAnnexBAccessUnitFromNALUs, debugAccessUnit } from './h264/h264-tools';
import { NALU } from './h264/nalu';

import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';

const { log, debug, warn } = getLogger('MP4MuxProcessor', LoggerLevel.ON, true);

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

// FIXME: get rid of FORCE_MP3 flag
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

  private audioBitstreamHeader_: BufferSlice = null;
  private videoBitstreamHeader_: BufferSlice = null;

  private embedCodecDataOnKeyframes_: boolean = true;

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

      this._addAudioTrack(
        // FIXME: get rid of FORCE_MP3 flag
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

      if (bufferSlice.props.isBitstreamHeader) {
        log('got video bitstream header at:', p.toString());
        this.videoBitstreamHeader_ = bufferSlice;
      } else {
        //debug('video packet:', p.toString());
      }

      if (bufferSlice.props.isKeyframe) {
        log('got keyframe at:', p.toString());

        if (this.embedCodecDataOnKeyframes_) {

          if (!this.videoBitstreamHeader_) {
            throw new Error('not video bitstream header found to embed')
          }

          const avcC: AvcC = <AvcC> AvcC.parse(this.videoBitstreamHeader_.getUint8Array());

          /*
          const auDelimiterNalu = makeNALUFromH264RbspData(
            BufferSlice.fromTypedArray(new Uint8Array([7 << 5])), NALU.AU_DELIM, 3)

          const endOfSeq = makeNALUFromH264RbspData(BufferSlice.allocateNew(0), 10, 3)
          const endOfStream = makeNALUFromH264RbspData(BufferSlice.allocateNew(0), 11, 3)
          */

          const spsNalu = makeNALUFromH264RbspData(BufferSlice.fromTypedArray(avcC.sps[0].subarray(1)), NALU.SPS, 3);
          const ppsNalu = makeNALUFromH264RbspData(BufferSlice.fromTypedArray(avcC.pps[0].subarray(1)), NALU.PPS, 3);

          const codecInitAu: BufferSlice
             = makeAnnexBAccessUnitFromNALUs([spsNalu, ppsNalu]);

          debugAccessUnit(codecInitAu)

          bufferSlice = bufferSlice.prepend(codecInitAu, bufferSlice.props);

        }

      }

      const data = bufferSlice.getUint8Array()

      mp4Muxer.pushPacket(
        MP4MuxPacketType.VIDEO_PACKET,
        AVC_VIDEO_CODEC_ID,
        data,
        p.getScaledDts(timescale),
        true, // NOTE: Non-raw mode expects FLV-packaged data
        bufferSlice.props.isBitstreamHeader, // NOTE: we are expecting an actual MP4 `avcc` ISOBMFF data atom as bitstream header
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

    // NOTE: Object-type is inherently defined by mp4mux.ts
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
        log('got audio bitstream header');
        this.audioBitstreamHeader_ = bufferSlice;
      }

      debug('audio packet:', p.toString());

      mp4Muxer.pushPacket(
        MP4MuxPacketType.AUDIO_PACKET,
        // FIXME: get rid of FORCE_MP3 flag
        FORCE_MP3 ? MP3_SOUND_CODEC_ID : AAC_SOUND_CODEC_ID,
        data,
        p.getScaledDts(timescale),
        true, // NOTE: Non-raw mode expects FLV-packaged data
        bufferSlice.props.isBitstreamHeader, // NOTE: we are expecting an actual MP4 `esds` ISOBMFF data atom as bitstream header
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

    log('creating audio track:', audioCodec, audioTrack.duration / audioTrack.timescale, 'secs');

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

    log('creating video track:', videoCodec, 'duration:', videoTrack.duration / timescale, 'secs');

    this.mp4Metadata_.videoTrackId = this._getNextTrackId();
    this.mp4Metadata_.tracks.push(videoTrack);

    if (!isNumber(this.mp4Metadata_.duration) && isNumber(videoTrack.duration)) {
      this.mp4Metadata_.duration = videoTrack.duration;
      log('set top-level metadata duration based on video-track:', this.mp4Metadata_.duration);
    }

    return videoTrack;
  }

  private onMp4MuxerData_ (data: Uint8Array) {
    // FIXME: put "real" precise codec strings
    const p: Packet = Packet.fromArrayBuffer(data.buffer, 'video/mp4; codecs="avc1.64001f,mp4a.40.2"');

    log('transferring new mp4 data:', p);

    this.out[0].transfer(p);
  }

  private onMp4MuxerCodecInfo_ (codecInfo: string[]) {
    log('got new codec info:', codecInfo);

    this.lastCodecInfo_ = codecInfo;
  }
}
