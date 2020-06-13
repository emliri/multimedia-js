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

const OUTPUT_FRAGMENTED_MODE = false;
const EMBED_CODEC_DATA_ON_KEYFRAME = true;
const FORCE_MP3 = false; // FIXME: get rid of FORCE_MP3 flag
const DEBUG_H264 = false;

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

export type MP4MuxProcessorOptions = {
  fragmentedMode: boolean,
  fragmentMinDurationSeconds: number,
  embedCodecDataOnKeyFrames: boolean,
  forceMp3: boolean
}

export class MP4MuxProcessor extends Processor {

  static getName (): string {
    return 'MP4MuxProcessor';
  }

  private mp4Muxer_: MP4Mux = null;
  private mp4Metadata_: MP4Metadata = null;
  private codecInfo_: string[] = [];
  private flushCounter_: number = 0;

  private _queuedVideoBitstreamHeader: boolean = false;
  private videoBitstreamHeader_: BufferSlice = null;

  private audioPacketQueue_: Packet[] = [];
  private videoPacketQueue_: Packet[] = [];

  private options_: MP4MuxProcessorOptions = {
    fragmentedMode: OUTPUT_FRAGMENTED_MODE,
    fragmentMinDurationSeconds: 1,
    embedCodecDataOnKeyFrames: EMBED_CODEC_DATA_ON_KEYFRAME,
    forceMp3: FORCE_MP3
  }

  private socketToTrackIndexHash_: {[i: number]: number} = {};

  // this simpler approach will restrict us to have only one audio and one video track for now
  private videoTrackIndex_: number;
  private audioTrackIndex_: number;

  constructor (options?: Partial<MP4MuxProcessorOptions>) {
    super();

    if (options) {
      this.options_ = Object.assign(this.options_, options);
    }

    this.createOutput();

    this._initMovieMetadata();

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

      if (this.options_.fragmentedMode
        && this.audioPacketQueue_.length > 16) {
        // FIXME: make this rather an optional feature
        this._flush();
      }

      this.audioPacketQueue_.push(p);

      if (this.mp4Metadata_.tracks[this.socketToTrackIndexHash_[inputIndex]]) {
        return true;
      }

      this.audioTrackIndex_ =
        this.socketToTrackIndexHash_[inputIndex] =
          this.mp4Metadata_.tracks.length;

      log('adding audio track with payload info:',p.defaultPayloadInfo)

      this._addAudioTrack(
        this.options_.forceMp3 ? MP4MuxProcessorSupportedCodecs.MP3 : MP4MuxProcessorSupportedCodecs.AAC,
        p.defaultPayloadInfo.getSamplingRate(),
        p.defaultPayloadInfo.sampleDepth,
        p.defaultPayloadInfo.details.numChannels,
        p.defaultPayloadInfo.details.codecProfile,
        p.defaultPayloadInfo.details.sequenceDurationInSeconds,
        p.getTimescale()
      );

      return true;

    } else if (p.defaultPayloadInfo.isVideo()) {

      if (this.options_.fragmentedMode
        && !this._queuedVideoBitstreamHeader && !p.defaultPayloadInfo.isBitstreamHeader) {
        return; // drop any packets received before we got codec init data
      }

      if (this.options_.fragmentedMode && p.defaultPayloadInfo.isKeyframe
        && this._queuedVideoBitstreamHeader && this.videoPacketQueue_.length > 1 + 1) {
        // FIXME: make this rather an optional feature
        this._flush();
      }

      this.videoPacketQueue_.push(p);

      if (p.defaultPayloadInfo.isBitstreamHeader) {
        this._queuedVideoBitstreamHeader = true
      }

      if (this.mp4Metadata_.tracks[this.socketToTrackIndexHash_[inputIndex]]) {
        return true;
      }

      this.videoTrackIndex_ =
        this.socketToTrackIndexHash_[inputIndex] =
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

    warn('Packet with hnhandled payload:', p);
    return false;

  }

  protected handleSymbolicPacket_ (symbol: PacketSymbol): boolean {
    switch (symbol) {
    case PacketSymbol.EOS:
      log('EOS received');
      this.flushCounter_++;
      if (this.flushCounter_ !== this.in.length) {
        break;
      }
      log('received EOS symbols count equal to inputs width, flushing');
      this.flushCounter_ = 0;
      this._flush();
    default:
      break;
    }

    return super.handleSymbolicPacket_(symbol);
  }

  private _processVideoPacket (p: Packet) {

    p.forEachBufferSlice((bufferSlice) => {

      const mp4Muxer = this.mp4Muxer_;

      if (bufferSlice.props.isBitstreamHeader) {

        if (this.videoBitstreamHeader_ && this.options_.fragmentedMode) {
          warn('dropping video codec info as in frag-mode and already got first one');
          return;
        }

        log('got new video bitstream header at:', p.toString());
        this.videoBitstreamHeader_ = bufferSlice;
      } else {
        debug('video packet:', p.toString());
        if (DEBUG_H264) {
          log('processing AVC AU:');
          debugAccessUnit(bufferSlice);
        }
      }

      if (bufferSlice.props.isKeyframe) {
        log('got keyframe at:', p.toString());

        if (this.options_.embedCodecDataOnKeyFrames) {
          if (!this.videoBitstreamHeader_) {
            throw new Error('not video bitstream header found to embed');
          }

          //const avcC: AvcC = <AvcC> AvcC.parse(this.videoBitstreamHeader_.getUint8Array());

          let avcC: AvcC;
          try {
            avcC = <AvcC> AvcC.parse(this.videoBitstreamHeader_.getUint8Array());
            log('parsed MP4 video-atom:', avcC);
          } catch(err) {
            warn('failed to parse slice-data expected to be AvcC atom:', this.videoBitstreamHeader_)
            debug('internal error is:', err)
            return;
          }

          /*
          const auDelimiterNalu = makeNALUFromH264RbspData(
            BufferSlice.fromTypedArray(new Uint8Array([7 << 5])), NALU.AU_DELIM, 3)

          /*
          const endOfSeq = makeNALUFromH264RbspData(BufferSlice.allocateNew(0), 10, 3)
          const endOfStream = makeNALUFromH264RbspData(BufferSlice.allocateNew(0), 11, 3)
          */

          if (avcC.sps.length > 0 && avcC.pps.length > 0) {
            // the SPS/PPS data we use comes already in a regular NALU but we rewrite the header just for fun
            // this is why we bust the first byte which is the header
            const spsNalu = makeNALUFromH264RbspData(BufferSlice.fromTypedArray(avcC.sps[0].subarray(1)), NALU.SPS, 3);
            const ppsNalu = makeNALUFromH264RbspData(BufferSlice.fromTypedArray(avcC.pps[0].subarray(1)), NALU.PPS, 3);

            const codecInitAu: BufferSlice =
              makeAnnexBAccessUnitFromNALUs([spsNalu, ppsNalu]);

            log('created codec-init AU data to insert in-stream')

            //DEBUG_H264 && debugAccessUnit(codecInitAu, false);

            bufferSlice = bufferSlice.prepend(codecInitAu, bufferSlice.props);

            DEBUG_H264 && debugAccessUnit(bufferSlice, false);
          }

        }
      }

      const data = bufferSlice.getUint8Array();

      mp4Muxer.pushPacket(
        MP4MuxPacketType.VIDEO_PACKET,
        AVC_VIDEO_CODEC_ID,
        data,
        p.dts,
        true, // TODO: remove raw-mode flag, deprecated
        bufferSlice.props.isBitstreamHeader, // FIXME: we are expecting an actual MP4 `avcc` ISOBMFF data atom as bitstream header, see H264-parse-proc
        bufferSlice.props.isKeyframe,
        p.cto
      );

    });
  }

  private _processAudioPacket (p: Packet) {
    const audioTrackMetadata = this.mp4Metadata_.tracks[this.audioTrackIndex_];

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

      debug('audio packet:', p.toString());

      mp4Muxer.pushPacket(
        MP4MuxPacketType.AUDIO_PACKET,
        // FIXME: get rid of FORCE_MP3 flag
        this.options_.forceMp3 ? MP3_SOUND_CODEC_ID : AAC_SOUND_CODEC_ID,
        data,
        p.dts,
        true, // TODO: remove raw-mode flag, deprecated
        false,
        bufferSlice.props.isKeyframe,
        p.cto,
        audioDetails
      );

    });
  }

  private _onInputCreated (eventData: ProcessorEventData) {
    log('input socket created');
  }

  private _initMovieMetadata () {
    this.mp4Metadata_ = {
      tracks: [],
      duration: 0,
      audioTrackId: NaN,
      videoTrackId: NaN
    };
  }

  private _initMuxer () {

    const enableGenerateMoov: boolean
      = this.options_.fragmentedMode ? this.codecInfo_.length === 0 : true;

    log('initMuxer() called with mp4 metadata model:', this.mp4Metadata_,
      'options:', JSON.stringify(this.options_), 'generate-moov:', enableGenerateMoov);

    const mp4Muxer = this.mp4Muxer_ = new MP4Mux(this.mp4Metadata_,
      this.options_.fragmentedMode, enableGenerateMoov);

    mp4Muxer.ondata = this.onMp4MuxerData_.bind(this);
    mp4Muxer.oncodecinfo = this.onMp4MuxerCodecInfo_.bind(this);
  }

  private _getNextTrackId (): number {
    return (this.mp4Metadata_.tracks.length + 1);
  }

  private _processQueues () {

    this._initMuxer();

    log('processing video packet queue', this.videoPacketQueue_);

    this.videoPacketQueue_.forEach((packet: Packet) => {
      this._processVideoPacket(packet);
    });
    this.videoPacketQueue_ = [];

    log('processing audio packet queue', this.audioPacketQueue_);

    this.audioPacketQueue_.forEach((packet: Packet) => {
      this._processAudioPacket(packet);
    });
    this.audioPacketQueue_ = [];
  }

  private _flush () {
    log('_flush() called, will flush internal muxer engine');
    this._processQueues();
    this.mp4Muxer_.flush();
  }

  private _addAudioTrack (
    audioCodec: MP4MuxProcessorSupportedCodecs,
    sampleRate: number,
    sampleSize: number,
    numChannels: number,
    audioObjectType: number,
    durationSeconds: number,
    timescale: number,
    language: string = 'und'
    ): MP4Track {

    if (isVideoCodec(audioCodec)) {
      throw new Error('Not an audio codec: ' + audioCodec);
    }

    let audioTrack: MP4Track = {
      duration: durationSeconds >= 0 ? durationSeconds * sampleRate : -1,
      codecDescription: audioCodec,
      codecId: getCodecId(audioCodec),
      language: language,
      timescale,
      samplerate: sampleRate,
      channels: numChannels,
      samplesize: sampleSize,
      audioObjectType
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

    log('creating video track:', videoCodec, 'duration:', videoTrack.duration / timescale, 'secs',
      ', sequence timescale:', timescale, 'fps:', framerate);

    this.mp4Metadata_.videoTrackId = this._getNextTrackId();
    this.mp4Metadata_.tracks.push(videoTrack);

    if (!isNumber(this.mp4Metadata_.duration) && isNumber(videoTrack.duration)) {
      this.mp4Metadata_.duration = videoTrack.duration;
      log('set top-level metadata duration based on video-track:', this.mp4Metadata_.duration);
    }

    return videoTrack;
  }

  private onMp4MuxerData_ (data: Uint8Array) {

    let mimeType: string;

    if (this.codecInfo_.length === 0) {
      warn(`Got mp4 output data without priorly signaled codecs infos! Using generic mime-type 'video/mp4'.`);
      mimeType = 'video/mp4';

    } else {
      const codecs = this.codecInfo_.join();

      const hasAudio = this.codecInfo_.some((val) => val.startsWith('mp4a.'));
      const hasVideo = this.codecInfo_.some((val) => val.startsWith('avc1.'));

      let mediaType: string;
      if (hasAudio && !hasVideo) {
        mediaType = 'audio';
      } else if (hasVideo) {
        mediaType = 'video';
      } else {
        throw new Error('Unexpected codec identifiers: ' + codecs);
      }

      mimeType = `${mediaType}/mp4; codecs="${codecs}"`
    }

    const p: Packet = Packet.fromArrayBuffer(data.buffer, mimeType);

    log('transferring new mp4 data:', p);

    this.out[0].transfer(p);
  }

  private onMp4MuxerCodecInfo_ (codecInfo: string[]) {
    log('got new codec info:', codecInfo);
    this.codecInfo_ = codecInfo;
  }
}
