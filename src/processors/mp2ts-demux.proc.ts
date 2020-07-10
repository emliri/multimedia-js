import { Processor } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { CommonMimeTypes, CommonCodecFourCCs } from '../core/payload-description';

import { getLogger, LoggerLevel } from '../logger';
import { debugAccessUnit, debugNALU } from './h264/h264-tools';
import { printNumberScaledAtDecimalOrder } from '../common-utils';

import { H264ParameterSetParser } from '../ext-mod/inspector.js/src/codecs/h264/param-set-parser';

import {
  M2tDemuxPipeline,
  M2tH264StreamEvent,
  M2tStream,
  M2tADTSStreamEvent,
  M2tElementaryStreamEvent,
  M2tNaluType,
} from './muxjs-m2t/muxjs-m2t-types';

import {
  CaptionStream,
  MetadataStream,
  TransportPacketStream,
  TransportParseStream,
  ElementaryStream,
  TimestampRolloverStream,
  AdtsStream,
  H264Codec
} from './muxjs-m2t/muxjs-m2t';

function mapNaluTypeToTag(m2tNaluType: M2tNaluType): string {
  switch(m2tNaluType) {
  case M2tNaluType.AUD: return "aud"; // TODO: make this stuff enums -> symbols or numbers (use actual NALU type ids)
  case M2tNaluType.SPS: return "sps";
  case M2tNaluType.PPS: return "pps";
  case M2tNaluType.SEI: return "sei";
  case M2tNaluType.IDR: return "idr";
  default: return null
  }
}

const MPEG_TS_TIMESCALE_HZ = 90000;

const DEBUG_PACKETS = false;

/*
import * as AacStream from '../ext-mod/mux.js/lib/aac';
import {isLikelyAacData} from '../ext-mod/mux.js/lib/aac/utils';
import {ONE_SECOND_IN_TS} from '../ext-mod/mux.js/lib/utils/clock';
*/

const { debug, log, info, warn } = getLogger('MP2TSDemuxProcessor', LoggerLevel.OFF, true);

const perf = performance;

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac', 'application/cea-608') // output
  );

type VideoNALUInfo = {nalu: M2tH264StreamEvent, dts: number, cto: number, isKeyframe: boolean, isHeader: boolean};

export class MP2TSDemuxProcessor extends Processor {

  static getName (): string {
    return 'MP2TSDemuxProcessor';
  }

  private _demuxPipeline: M2tDemuxPipeline;

  private _audioSocket: OutputSocket = null;
  private _audioDtsOffset: number = null;

  private _videoSocket: OutputSocket = null;
  private _videoDtsOffset: number = null
  private _videoFirstKeyFrameDts: number = null;
  private _videoConfig: M2tH264StreamEvent = null;
  private _videoPictureParamSet: boolean = false;
  private _videoTimingCache: M2tH264StreamEvent = null;
  private _videoTimingQueueIn: M2tH264StreamEvent[] = [];
  private _videoTimingQueueOut: VideoNALUInfo[] = [];
  private _videoFramerate: number = null;

  private _outPackets: Packet[] = [];

  constructor () {
    super();
    this.createInput();

    this._setupPipeline()
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  private _setupPipeline() {

    const pipeline: Partial<M2tDemuxPipeline> = {};

    // set up the parsing pipeline
    pipeline.packetStream = new TransportPacketStream() as unknown as M2tStream;
    pipeline.parseStream = new TransportParseStream() as unknown as M2tStream;
    pipeline.elementaryStream = new ElementaryStream() as unknown as M2tStream;
    pipeline.timestampRolloverStream = new TimestampRolloverStream(null) as unknown as M2tStream;
    // payload demuxers
    pipeline.aacOrAdtsStream = new AdtsStream.default() as unknown as M2tStream;
    pipeline.h264Stream = new H264Codec.H264Stream() as unknown as M2tStream;
    pipeline.metadataStream = new MetadataStream();
    // CEA captions are special AVC NALUs
    pipeline.captionStream = new CaptionStream() as unknown as M2tStream;

    // easy handle to headend of pipeline
    pipeline.headOfPipeline = pipeline.packetStream as unknown as M2tStream;

    // disassemble MPEG2-TS packets into elementary streams
    pipeline.packetStream
      .pipe(pipeline.parseStream)
      .pipe(pipeline.elementaryStream)
      .pipe(pipeline.timestampRolloverStream);

    // demux the streams
    pipeline.timestampRolloverStream
      .pipe(pipeline.h264Stream);

    pipeline.timestampRolloverStream
      .pipe(pipeline.aacOrAdtsStream);

    pipeline.timestampRolloverStream
      .pipe(pipeline.metadataStream);

    // Hook up CEA-608/708 caption stream
    pipeline.h264Stream.pipe(pipeline.captionStream);

    if (DEBUG_PACKETS) {
      // debug TS packets, find PAT/PMT
      pipeline.parseStream.on('data', (data) => {
        console.log('TS:',data)
      })
      pipeline.elementaryStream.on('data', (data: M2tElementaryStreamEvent) => {
        console.log('ES:', data)
      });
    }

    pipeline.h264Stream.on('data', (data: M2tH264StreamEvent) => {
      log('h264Stream:', data)

      // Video FPS not determined yet
      if (this._videoFramerate === null) {
        this._queueVideoTimingNalu(data);
      } else {
        this._handleVideoNalu(data);
      }
    })

    pipeline.aacOrAdtsStream.on('data', (data: M2tADTSStreamEvent) => {
      log('aacOrAdtsStream:', data)
      this._handleAudioNalu(data);
    })

    this._demuxPipeline = pipeline as M2tDemuxPipeline;

  }

  private _queueVideoTimingNalu(data: M2tH264StreamEvent) {
    this._videoTimingQueueIn.push(data);
    for (let i = this._videoTimingQueueIn.length - 1; i > 0; i--) { // -> will only run when queue length > 1
      const frameDuration = (data.dts - this._videoTimingQueueIn[i - 1].dts);
      if (frameDuration <= 0 || ! Number.isFinite(frameDuration)) {
        continue;
      }
      this._videoFramerate = Math.round(MPEG_TS_TIMESCALE_HZ / frameDuration);
      info('got frame-duration / fps:', frameDuration, '/ 90kHz ;', this._videoFramerate, '[f/s]')
      break;
    }
    if (this._videoFramerate) {
      this._videoTimingQueueIn.forEach((data) => {
        this._handleVideoNalu(data);
      });
      this._videoTimingQueueIn.length = 0;
    }
  }

  private _handleAudioNalu(adtsEvent: M2tADTSStreamEvent) {

    const dts = adtsEvent.dts - this._audioDtsOffset;
    const cto = adtsEvent.pts - adtsEvent.dts;

    const sampleData: Uint8Array = adtsEvent.data;

    const bufferSlice = new BufferSlice(
      sampleData.buffer,
      sampleData.byteOffset,
      sampleData.byteLength);

    const packet = Packet.fromSlice(bufferSlice,
      dts,
      cto
    );

    // FIXME: move this out of iteration as well as creating BufferProperties once and
    // only mutating where necessary
    const mimeType = CommonMimeTypes.AUDIO_AAC;

    // TODO: To optimize performance,
    // try to re-use the same heap-object instance here
    // for as many buffers as possible
    bufferSlice.props = new BufferProperties(mimeType, adtsEvent.samplerate, 16); // Q: is it always 16 bit ?
    bufferSlice.props.samplesCount = adtsEvent.sampleCount;
    bufferSlice.props.codec = CommonCodecFourCCs.mp4a;
    bufferSlice.props.isKeyframe = true;
    bufferSlice.props.isBitstreamHeader = false;
    bufferSlice.props.details.samplesPerFrame = 1024; // AAC has constant samples-per-frame rate of 1024
    bufferSlice.props.details.codecProfile = adtsEvent.audioobjecttype;
    bufferSlice.props.details.numChannels = adtsEvent.channelcount;

    // TODO: compute bitrate
    //bufferSlice.props.details.constantBitrate =

    if (this._audioDtsOffset === null) {
      //this._audioDtsOffset = adtsEvent.dts
      this._audioDtsOffset = 0
    }

    //packet.setTimestampOffset(this._audioDtsOffset);
    packet.setTimescale(MPEG_TS_TIMESCALE_HZ)

    this._outPackets.push(packet);
  }

  private _handleVideoNalu(h264Event: M2tH264StreamEvent) {

    if (h264Event.config) {
      this._videoConfig = h264Event;
      info('Got video codec config slice:', this._videoConfig);
      info('Parsed SPS:', H264ParameterSetParser.parseSPS(this._videoConfig.data.subarray(1)))
    }

    if (!this._videoConfig) {
      warn('Skipping H264 data before got first param-sets, NALU-type:', mapNaluTypeToTag(h264Event.nalUnitType));
      return;
    }

    if (h264Event.nalUnitType === M2tNaluType.AUD) return;

    if (this._videoDtsOffset === null) {
      //this._videoDtsOffset = h264Event.dts
      this._videoDtsOffset = 0
    }

    if (h264Event.nalUnitType === M2tNaluType.PPS) {
      this._videoPictureParamSet = true;
    }

    let isKeyframe: boolean = false;
    if (h264Event.nalUnitType === M2tNaluType.IDR) {
      isKeyframe = true;
      if (this._videoFirstKeyFrameDts === null) {
        this._videoFirstKeyFrameDts = h264Event.dts;
      }
      if (!this._videoPictureParamSet) {
        warn('Got IDR without previously seeing a PPS NALU');
      }
    }

    let isHeader: boolean = false;
    if (h264Event.nalUnitType === M2tNaluType.SPS
      || h264Event.nalUnitType === M2tNaluType.PPS) {
      isHeader = true;
    }

    if (this._videoFramerate === null) {
      warn('No video-fps/samplerate detectable yet');
    }

    let dts: number;
    let cto: number;

    // Q: It is weird that we have to do this and is a bug in mux.js ???
    if (this._videoTimingCache) {
      dts = h264Event.dts - this._videoDtsOffset;
      cto = this._videoTimingCache.pts - this._videoTimingCache.dts;
    } else {
      dts = h264Event.dts - this._videoDtsOffset;
      cto = h264Event.pts - h264Event.dts;
    }
    this._videoTimingCache = h264Event;

    this._pushVideoH264NALU({nalu: h264Event, dts, cto, isKeyframe, isHeader})

  }

  private _pushVideoH264NALU(nalInfo: VideoNALUInfo) {

    const {dts: nextDts, isHeader: nextIsHeader} = nalInfo;

    const needQueueFlush = this._videoTimingQueueOut.length > 0
                          && (nextDts !== this._videoTimingQueueOut[0].dts || nextIsHeader);

    if (needQueueFlush) {

      const {dts, cto, nalu, isKeyframe, isHeader} = this._videoTimingQueueOut[0];

      const props = new BufferProperties(
        CommonMimeTypes.VIDEO_H264,
        this._videoFramerate || 0, // sample-rate (Hz)
        8, // sampleDepth
        1, // sample-duration num
        1 // samples-per-frame
      );

      props.codec = CommonCodecFourCCs.avc1;
      props.elementaryStreamId = nalu.trackId

      props.isKeyframe = isKeyframe;
      props.isBitstreamHeader = isHeader;

      props.details.width = this._videoConfig.config.width
      props.details.height = this._videoConfig.config.height;
      props.details.codecProfile = this._videoConfig.config.profileIdc;

      props.details.samplesPerFrame = 1;

      props.tags.add('nalu');
      // add NALU type tags for all slices
      this._videoTimingQueueOut.forEach(({nalu}) => {
        const naluTag = mapNaluTypeToTag(nalu.nalUnitType)
        // may be null for non-IDR-slice
        if (naluTag) {
          props.tags.add(naluTag);
        }
      })

      // create multi-slice packet
      const slices = this._videoTimingQueueOut.map(({nalu}) => {
        const bs = new BufferSlice(
          nalu.data.buffer,
          nalu.data.byteOffset,
          nalu.data.byteLength,
          props // share same props for all slices
        );
        return bs;
      })

      const packet = Packet.fromSlices(
        dts,
        cto,
        ... slices
      );

      //packet.setTimestampOffset(this._videoDtsOffset); // check if this works out downstream
      packet.setTimescale(MPEG_TS_TIMESCALE_HZ)
      debug('created/pushed packet:', packet.toString());
      this._outPackets.push(packet);

      this._videoTimingQueueOut.length = 0;
    }

    this._videoTimingQueueOut.push(nalInfo);
  }

  private _onOutPacketsPushed() {
    const outputPackets: Packet[] = this._outPackets;

    let audioSocket: OutputSocket = this._audioSocket;
    let videoSocket: OutputSocket = this._videoSocket;

    outputPackets.forEach((p: Packet) => {

      if (p.isSymbolic()) {
        log('got symbolic packet:', p.getSymbolName(), '(noop/ignoring)');
        return;
      }

      debug(`processing non-symbolic packet of ${p.getTotalBytes()} bytes`);

      if (!p.defaultPayloadInfo) {
        warn('packet has not default payload, dropping:', p.toString(), 'object:', p);
        return;
      }

      // FIXME: make two queues (audio/video) and optimize away this check here
      if (p.defaultPayloadInfo.isVideo()) {

        debug('got video packet:', p.toString())

        if (!videoSocket) {
          log('creating video output socket:', p.defaultPayloadInfo)
          this._videoSocket = videoSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        //p.forEachBufferSlice((bs) => debugNALU(bs));

        debug('transferring video packet to default out');

        if (p.defaultPayloadInfo.isBitstreamHeader) {
          log('found bitstream header part in packet:', p.defaultPayloadInfo.tags, p.data)
        }

        videoSocket.transfer(p);

      // FIXME: make two queues (audio/video) and optimize away this check here
      } else if (p.defaultPayloadInfo.isAudio()) {

        debug('got audio packet:', p.toString())

        if (!audioSocket) {
          log('creating audio output socket:', p.defaultPayloadInfo)
          this._audioSocket = audioSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        debug('transferring audio packet to default out');

        audioSocket.transfer(p);

      } else {
        throw new Error('Unsupported payload: ' + p.defaultMimeType);
      }
    });

    this._outPackets.length = 0; // clear queue

  }

  protected processTransfer_ (inS: InputSocket, inPacket: Packet) {
    log(`feeding demuxer with chunk of ${printNumberScaledAtDecimalOrder(inPacket.getTotalBytes(), 3)} Kbytes`)
    const startDemuxingMs = perf.now();
    this._demuxPipeline.headOfPipeline.push(inPacket.data[0].getUint8Array());
    const demuxingRunTimeMs = perf.now() - startDemuxingMs;
    log(`got ${this._outPackets.length} output packets from running demuxer (perf-stats: this took ${demuxingRunTimeMs.toFixed(3)} millis doing)`)
    this._onOutPacketsPushed();
    return true;
  }
}
