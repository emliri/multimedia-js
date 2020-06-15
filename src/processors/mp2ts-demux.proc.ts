import { Processor } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { CommonMimeTypes } from '../core/payload-description';

import { getLogger, LoggerLevel } from '../logger';
import { debugAccessUnit, debugNALU } from './h264/h264-tools';
import { printNumberScaledAtDecimalOrder } from '../common-utils';

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
  case M2tNaluType.AUD: return "aud";
  case M2tNaluType.SPS: return "sps";
  case M2tNaluType.PPS: return "pps";
  case M2tNaluType.SEI: return "pps";
  case M2tNaluType.IDR: return "idr";
  default: return null
  }
}

const MPEG_TS_TIMESCALE_HZ = 90000;

/*
import * as AacStream from '../ext-mod/mux.js/lib/aac';
import {isLikelyAacData} from '../ext-mod/mux.js/lib/aac/utils';
import {ONE_SECOND_IN_TS} from '../ext-mod/mux.js/lib/utils/clock';
*/

const { debug, log, info, warn } = getLogger('MP2TSDemuxProcessor', LoggerLevel.DEBUG, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac', 'application/cea-608') // output
  );


export class MP2TSDemuxProcessor extends Processor {

  static getName (): string {
    return 'MP2TSDemuxProcessor';
  }

  /*
  private _programMap: {[pid: number]: OutputSocket} = {};
  private _haveAudio: boolean = false;
  private _haveVideo: boolean = false;
  //private _firstDtsOffset90khz: number | null = null; // WIP: actually build a packet-filter for this which will set each packet time-offset on a sequence
  */

  private _demuxPipeline: M2tDemuxPipeline;

  private _audioSocket: OutputSocket = null;
  private _audioDtsOffset: number = null;

  private _videoSocket: OutputSocket = null;
  private _videoDtsOffset: number = null
  private _videoConfig: M2tH264StreamEvent = null;

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

    pipeline.metadataStream = new MetadataStream();
    // set up the parsing pipeline
    pipeline.packetStream = new TransportPacketStream() as unknown as M2tStream;
    pipeline.parseStream = new TransportParseStream() as unknown as M2tStream;
    pipeline.elementaryStream = new ElementaryStream() as unknown as M2tStream;
    pipeline.timestampRolloverStream = new TimestampRolloverStream() as unknown as M2tStream;
    pipeline.aacOrAdtsStream = new AdtsStream.default() as unknown as M2tStream;
    pipeline.h264Stream = new H264Codec.H264Stream() as unknown as M2tStream;
    pipeline.captionStream = new CaptionStream() as unknown as M2tStream;
    pipeline.headOfPipeline = pipeline.packetStream as unknown as M2tStream;

    // disassemble MPEG2-TS packets into elementary streams
    pipeline.packetStream
      .pipe(pipeline.parseStream)
      .pipe(pipeline.elementaryStream)
      .pipe(pipeline.timestampRolloverStream);

    // !!THIS ORDER IS IMPORTANT!!
    // demux the streams
    pipeline.timestampRolloverStream
      .pipe(pipeline.h264Stream);

    pipeline.timestampRolloverStream
      .pipe(pipeline.aacOrAdtsStream);

    pipeline.timestampRolloverStream
      .pipe(pipeline.metadataStream);

    // Hook up CEA-608/708 caption stream
    pipeline.h264Stream.pipe(pipeline.captionStream);

    pipeline.h264Stream.on('data', (data: M2tH264StreamEvent) => {
      log('h264Stream:', data)
      this._handleVideoNalu(data);
    })

    pipeline.aacOrAdtsStream.on('data', (data: M2tADTSStreamEvent) => {
      log('aacOrAdtsStream:', data)
      this._handleAudioNalu(data);
    })

    pipeline.elementaryStream.on('data', (data: M2tElementaryStreamEvent) => {
      //log('ES:', data)
      if (data.type === 'metadata') {
        //
      }
    });

    this._demuxPipeline = pipeline as M2tDemuxPipeline;

  }

  private _handleAudioNalu(adtsEvent: M2tADTSStreamEvent) {
      // FIXME: move this out of iteration as well as creating BufferProperties once and
      // only mutating where necessary
      const mimeType = CommonMimeTypes.AUDIO_AAC;

      const sampleData: Uint8Array = adtsEvent.data;

      const bufferSlice = new BufferSlice(
        sampleData.buffer.slice(0),
        sampleData.byteOffset,
        sampleData.byteLength);

      // TODO: To optimize performance,
      // try to re-use the same heap-object instance here
      // for as many buffers as possible
      bufferSlice.props = new BufferProperties(mimeType, adtsEvent.samplerate, 16);
      bufferSlice.props.samplesCount = adtsEvent.sampleCount;
      bufferSlice.props.codec = 'aac'; // 'mp4a' ?
      bufferSlice.props.isKeyframe = true;
      bufferSlice.props.isBitstreamHeader = false;
      bufferSlice.props.details.samplesPerFrame = 1024;
      bufferSlice.props.details.codecProfile = adtsEvent.audioobjecttype;
      bufferSlice.props.details.numChannels = adtsEvent.channelcount;

      if (this._audioDtsOffset === null) {
        this._audioDtsOffset = adtsEvent.dts
      }

      const packet = Packet.fromSlice(bufferSlice,
        adtsEvent.dts - this._audioDtsOffset,
        adtsEvent.pts - adtsEvent.dts
      );

      packet.setTimestampOffset(this._audioDtsOffset);
      packet.setTimescale(MPEG_TS_TIMESCALE_HZ)

      this._outPackets.push(packet);
  }

  private _handleVideoNalu(h264Event: M2tH264StreamEvent) {

    if (h264Event.config) {
      this._videoConfig = h264Event;
      info('Got video codec config slice:', this._videoConfig);
    }

    if (!this._videoConfig) {
      warn('Skipping H264 data before got first SPS');
      return;
    }

    const bufferSlice = new BufferSlice(
      h264Event.data.buffer.slice(0),
      h264Event.data.byteOffset,
      h264Event.data.byteLength);

    bufferSlice.props = new BufferProperties(
      CommonMimeTypes.VIDEO_H264,
      24, // sample-rate <--- FIXME: !!! :D
      8, // sampleDepth
      1, // sample-duration num
      1 // samples-per-frame
    );

    bufferSlice.props.codec = 'avc'; // 'avc1' ?
    bufferSlice.props.elementaryStreamId = h264Event.trackId

    bufferSlice.props.isKeyframe = h264Event.nalUnitType === M2tNaluType.IDR;
    bufferSlice.props.isBitstreamHeader = h264Event.nalUnitType === M2tNaluType.SPS || h264Event.nalUnitType === M2tNaluType.PPS; // SPS/PPS

    bufferSlice.props.details.width = this._videoConfig.config.width
    bufferSlice.props.details.height = this._videoConfig.config.height;
    bufferSlice.props.details.codecProfile = null;

    bufferSlice.props.details.samplesPerFrame = 1;

    bufferSlice.props.tags.add('nalu');

    const naluTag = mapNaluTypeToTag(h264Event.nalUnitType) // may be null for non-IDR-slice
    naluTag && bufferSlice.props.tags.add(naluTag);

    if (this._videoDtsOffset === null) {
      this._videoDtsOffset = h264Event.dts
    }

    const packet = Packet.fromSlice(
      bufferSlice,
      h264Event.dts - this._videoDtsOffset,
      h264Event.pts - h264Event.dts
      );

    packet.setTimestampOffset(this._videoDtsOffset); // check if this works out downstream
    packet.setTimescale(MPEG_TS_TIMESCALE_HZ)

    debug('created packet:', packet.toString());

    this._outPackets.push(packet);

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

        p.forEachBufferSlice((bs) => debugNALU(bs));

        debug('transferring video packet to default out');

        if (p.defaultPayloadInfo.isBitstreamHeader) {
          log('found bitstream header part in packet:', p.defaultPayloadInfo.tags)
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
    const perf = self.performance;
    const startDemuxingMs = perf.now();
    this._demuxPipeline.headOfPipeline.push(inPacket.data[0].getUint8Array());
    const demuxingRunTimeMs = perf.now() - startDemuxingMs;
    log(`got ${this._outPackets.length} output packets from running demuxer (perf-stats: this took ${demuxingRunTimeMs.toFixed(3)} millis doing)`)
    this._onOutPacketsPushed();
    return true;
  }
}
