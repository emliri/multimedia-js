import { Processor, ProcessorEvent } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { CommonMimeTypes, CommonCodecFourCCs, MimetypePrefix } from '../core/payload-description';
import { ShadowOutputSocket } from '../core/socket-output';

import { printNumberScaledAtDecimalOrder } from '../common-utils';
import { getLogger, LoggerLevel } from '../logger';
import { getPerfNow } from '../perf-ctx';

import { mpeg2TsClockToSecs, MPEG_TS_TIMESCALE_HZ } from './mpeg2ts/mpeg2ts-utils';
import { debugNALU, H264NaluType, parseNALU } from './h264/h264-tools';

import { H264ParameterSetParser } from '../ext-mod/inspector.js/src/codecs/h264/param-set-parser';

import { MpegTSDemuxer } from '../ext-mod/inspector.js/src/demuxer/ts/mpegts-demuxer';
import { H264Reader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/h264-reader';
import { Track } from '../ext-mod/inspector.js/src/demuxer/track';
import { TSTrack } from '../ext-mod/inspector.js/src';
import { NAL_UNIT_TYPE } from '../ext-mod/inspector.js/src/codecs/h264/nal-units';
import { AdtsReader } from '../ext-mod/inspector.js/src/demuxer/ts/payload/adts-reader';
import { MICROSECOND_TIMESCALE } from '../ext-mod/inspector.js/src/utils/timescale';
import { AAC_SAMPLES_PER_FRAME } from './aac/adts-utils';

const { debug, log, info, warn } = getLogger('Mp2TsDemuxProc2', LoggerLevel.ON, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // input
    SocketDescriptor.fromMimeTypes(
      'audio/mpeg', 'audio/adts',
      'video/h264',
      'application/cea-608',
      'application/unknown') // output
  );

export class Mp2TsDemuxProc2 extends Processor {
  static getName (): string {
    return 'Mp2TsDemuxProc2';
  }

  private _tsParser: MpegTSDemuxer = new MpegTSDemuxer();

  private _outPackets: Packet[] = [];

  private _audioSocket: OutputSocket = null;
  private _videoSocket: OutputSocket = null;
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
    Object.values(this._tsParser.tracks).forEach((track) => {
      switch (track.type) {
      case Track.TYPE_AUDIO:
        track.pes.onPayloadData = (data, timeUs, naluType) => {
          this._onAudioPayload(track, data, timeUs);
        }
        break;
      case Track.TYPE_VIDEO:
        track.pes.onPayloadData = (data, timeUs, naluType) => {
          this._onVideoPayload(track, data, timeUs, naluType);
        }
        break;
      }
    });
  }

  private _onAudioPayload (track: TSTrack, data: Uint8Array, timeMs: number) {

    //console.log(data.byteLength, timeMs);

    const payloadReader = track.pes.payloadReader as AdtsReader;

    const bufferSlice = BufferSlice.fromTypedArray(
      data,
      new BufferProperties(CommonMimeTypes.AUDIO_AAC,
        payloadReader.currentFrameInfo.sampleRate, // Hz
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
    bufferSlice.props.details.samplesPerFrame = AAC_SAMPLES_PER_FRAME; // AAC has constant samples-per-frame rate of 1024
    bufferSlice.props.details.codecProfile = payloadReader.currentFrameInfo.profile;
    bufferSlice.props.details.numChannels = 2; // todo

    //console.log(data, timeMs)
    if (!this._audioSocket) {
      this._audioSocket = this.createOutput(SocketDescriptor.fromBufferProps(bufferSlice.props));
    }

    const packet = Packet.fromSlice(bufferSlice, timeMs)
      .setTimescale(MICROSECOND_TIMESCALE);

    this._audioSocket.transfer(packet);
  }

  private _onVideoPayload (track: TSTrack,
    data: Uint8Array, timeMs: number,
    naluType: number) {
    //console.log(data.byteLength, timeMs)

    //console.log(data.byteLength, timeMs);

    if (naluType === NAL_UNIT_TYPE.AUD) return;

    const payloadReader = track.pes.payloadReader as H264Reader;

    if (!payloadReader.sps) return;

    const props = new BufferProperties(
      CommonMimeTypes.VIDEO_H264
    );
    props.samplesCount = 1;

    props.codec = CommonCodecFourCCs.avc1;
    props.elementaryStreamId = track.id;

    props.details.width = payloadReader.sps.codecSize.width
    props.details.height = payloadReader.sps.codecSize.height
    props.details.codecProfile = payloadReader.sps.profileIdc;
    props.details.samplesPerFrame = 1;

    let isHeader;
    let isKeyframe;
    switch(naluType) {
    case NAL_UNIT_TYPE.IDR:
      isKeyframe = true;
      break;
    case NAL_UNIT_TYPE.SPS:
      isHeader = true;
      break;
    case NAL_UNIT_TYPE.PPS:
      isHeader = true;
      break;
    default:
      break;
    }

    if (isHeader) {
      props.isBitstreamHeader = true;
    }
    if (isKeyframe) {
      props.isKeyframe = true;
    }

    props.tags.add('nalu');
    const naluTag = NAL_UNIT_TYPE[naluType]?.toLowerCase();
    if (naluTag) {
      props.tags.add(naluTag);
    }

    if (!this._videoSocket) {
      this._videoSocket = this.createOutput(SocketDescriptor.fromBufferProps(props));
    }

    const packet = Packet.fromSlice(BufferSlice.fromTypedArray(data, props))
      .setTimescale(MICROSECOND_TIMESCALE);

    this._videoSocket.transfer(packet);
  }
}
