import { Processor, ProcessorEvent } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { ShadowOutputSocket } from '../core/socket-output';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { CommonMimeTypes, CommonCodecFourCCs, MimetypePrefix } from '../core/payload-description';

import { getLogger, LoggerLevel } from '../logger';
import { prntprtty } from '../common-utils';

import { MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';
import { debugNALU, H264NaluType, parseNALU } from './h264/h264-tools';

import { H264ParameterSetParser } from '../ext-mod/inspector.js/src/codecs/h264/param-set-parser';

import { MpegTSDemuxer } from '../ext-mod/inspector.js/src/demuxer/ts/mpegts-demuxer';
import { H264Reader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/h264-reader';
import { TrackType } from '../ext-mod/inspector.js/src/demuxer/track';
import { TSTrack } from '../ext-mod/inspector.js/src';
import { NAL_UNIT_TYPE } from '../ext-mod/inspector.js/src/codecs/h264/nal-units';
import { AdtsReader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/adts-reader';
import { AAC_SAMPLES_PER_FRAME } from './aac/adts-utils';

const { debug, log, info, warn } = getLogger('Mp2TsDemuxProc2', LoggerLevel.OFF, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // input
    SocketDescriptor.fromMimeTypes(
      'audio/mpeg', 'audio/adts',
      'video/h264',
      'application/cea-608',
      'application/unknown') // output
  );

const ENABLE_AUDIO_PTS_ERROR_COMPENSATION = false;

export class Mp2TsDemuxProc2 extends Processor {
  static getName (): string {
    return 'Mp2TsDemuxProc2';
  }

  private _tsParser: MpegTSDemuxer = new MpegTSDemuxer();

  private _audioSocket: OutputSocket = null;
  private _videoSocket: OutputSocket = null;

  private _lastAudioDts: number = NaN;
  private _lastVideoDts: number = NaN;

  private _pendingVideoPkt: Packet = null;
  private _gotFirstSps = false;
  private _gotFirstPps = false;

  private _gotFirstPmt: boolean = false;

  private _videoSeiOutSocket: OutputSocket = null;
  private _metadataSocketMap: {[pid: number]: OutputSocket} = {};

  constructor () {
    super();
    this.createInput();

    this._tsParser.onProgramMapUpdate = this._onPmtUpdated.bind(this);
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_ (sock: InputSocket, p: Packet) {
    const pktData = p.data[0].getUint8Array();
    this._tsParser.append(pktData);
    // free fully parsed packet data
    this._tsParser.prune();
    return true;
  }

  private _onPmtUpdated () {
    log('PMT updated, new stream-types mapping:', prntprtty(this._tsParser.tracks));

    if (!this._gotFirstPmt) {
      this._gotFirstPmt = true;

      const avMimeTypes: MimetypePrefix[] = [];

      Object.values(this._tsParser.tracks).forEach((track) => {
        switch (track.type) {
        case TrackType.AUDIO:
          avMimeTypes.push(MimetypePrefix.AUDIO);
          track.pes.onPayloadData = (data, dts) => {
            this._onAudioPayload(track, data, dts);
          };
          break;
        case TrackType.VIDEO:
          avMimeTypes.push(MimetypePrefix.VIDEO);
          track.pes.onPayloadData = (data, dts, cto, naluType) => {
            this._onVideoPayload(track, data, dts, cto, naluType);
          };
          break;
        }
      });

      this.emitEvent(ProcessorEvent.OUTPUT_SOCKET_SHADOW, {
        socket: new ShadowOutputSocket(avMimeTypes)
      });
    }
  }

  private _onAudioPayload (track: TSTrack, data: Uint8Array, dts: number) {
    const payloadReader = track.pes.payloadReader as AdtsReader;

    const sampleRate = payloadReader.currentSampleRate;

    const bufferSlice = BufferSlice.fromTypedArray(
      data,
      new BufferProperties(CommonMimeTypes.AUDIO_AAC,
        sampleRate, // Hz
        16, // audio bitdepth (should always be this with AAC)
        1 // sample-duration numerator
      )
    );

    // NOTE: buffer-props is per-se not cloned on packet transfer,
    // so we must create/ref a single prop-object per packet (full-ownership).
    bufferSlice.props.samplesCount = 1;
    bufferSlice.props.codec = CommonCodecFourCCs.mp4a;
    bufferSlice.props.isKeyframe = true;
    bufferSlice.props.isBitstreamHeader = false;

    // extract payload-specific info
    const { numFrames, aacObjectType, channels } = payloadReader.currentFrameInfo;

    if (ENABLE_AUDIO_PTS_ERROR_COMPENSATION) {
      const dtsDiff = dts - this._lastAudioDts;
      if (Number.isFinite(dtsDiff)) {
        const expectedContinuousDiff = numFrames * AAC_SAMPLES_PER_FRAME;
        const continuityErr = dtsDiff - expectedContinuousDiff;
        if (continuityErr != 0) {
          warn(`Correcting audio DTS timing continuity-error of ${continuityErr} samples; ${continuityErr / sampleRate} secs`);
          dts -= continuityErr;
        }
      }
    }

    bufferSlice.props.details.samplesPerFrame = numFrames * AAC_SAMPLES_PER_FRAME;
    bufferSlice.props.details.codecProfile = aacObjectType;
    bufferSlice.props.details.numChannels = channels;

    if (!this._audioSocket) {
      this._audioSocket = this.createOutput(SocketDescriptor.fromBufferProps(bufferSlice.props));
    }

    const timeScale = payloadReader.currentFrameInfo.sampleRate;

    const packet = Packet.fromSlice(bufferSlice)
      .setTimingInfo(dts, 0, timeScale);

    this._lastAudioDts = dts;
    this._audioSocket.transfer(packet);
  }

  private _onVideoPayload (track: TSTrack,
    data: Uint8Array,
    dts: number,
    cto: number,
    naluType: number) {
    const payloadReader = track.pes.payloadReader as H264Reader;

    if (!payloadReader.sps) return;

    const props = new BufferProperties(
      CommonMimeTypes.VIDEO_H264
    );
    props.samplesCount = 1;

    props.codec = CommonCodecFourCCs.avc1;
    props.elementaryStreamId = track.id;

    props.details.width = payloadReader.sps.codecSize.width;
    props.details.height = payloadReader.sps.codecSize.height;
    props.details.codecProfile = payloadReader.sps.profileIdc;
    props.details.samplesPerFrame = 1;

    let isHeader = false;
    let isKeyframe = false;
    let isAud = false;
    switch (naluType) {
    case NAL_UNIT_TYPE.IDR:
      isKeyframe = true;
      break;
    case NAL_UNIT_TYPE.SPS:
      this._gotFirstSps = true;
      isHeader = true;
      break;
    case NAL_UNIT_TYPE.PPS:
      this._gotFirstPps = true;
      isHeader = true;
      break;
    case NAL_UNIT_TYPE.AUD:
      isAud = true;
      break;
    case NAL_UNIT_TYPE.SLICE:
      break;
    case NAL_UNIT_TYPE.SEI:
      break;
    default:
      break;
    }

    props.isBitstreamHeader = isHeader;
    props.isKeyframe = isKeyframe;

    props.tags.add('nalu');
    const naluTag = NAL_UNIT_TYPE[naluType]?.toLowerCase();
    if (naluTag) {
      props.tags.add(naluTag);
    }

    if (!this._videoSocket) {
      this._videoSocket = this.createOutput(SocketDescriptor.fromBufferProps(props));
    }

    if (isHeader) {
      const packet = Packet
        .fromSlice(BufferSlice.fromTypedArray(data, props))
        .setTimingInfo(dts, cto, MPEG_TS_TIMESCALE_HZ);

      this._lastVideoDts = packet.timestamp;
      this._videoSocket.transfer(packet);
      return;
    }

    if (!(this._gotFirstSps && this._gotFirstPps)) {
      return;
    }

    if (!this._pendingVideoPkt) {
      const packet = Packet
        .fromSlice(BufferSlice.fromTypedArray(data, props))
        .setTimingInfo(dts, cto, MPEG_TS_TIMESCALE_HZ);
      this._pendingVideoPkt = packet;
    } else {
      this._pendingVideoPkt.properties.addTags(Array.from(props.tags.values()));
      this._pendingVideoPkt.data.push(BufferSlice.fromTypedArray(data, props));
    }

    if (isAud) {
      this._lastVideoDts = this._pendingVideoPkt.timestamp;
      this._videoSocket.transfer(this._pendingVideoPkt);
      this._pendingVideoPkt = null;
    }
  }
}
