import { Processor } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';
import { BufferSlice } from '../core/buffer';
import { BufferProperties } from '../core/buffer-props';
import { CommonMimeTypes } from '../core/payload-description';

import { getLogger, LoggerLevel } from '../logger';
import { debugAccessUnit, debugNALU } from './h264/h264-tools';
import { printNumberScaledAtDecimalOrder } from '../common-utils';

import * as m2ts from '../ext-mod/mux.js/lib/m2ts/m2ts';
import * as AdtsStream from '../ext-mod/mux.js/lib/codecs/adts.js';
import * as H264Codec from '../ext-mod/mux.js/lib/codecs/h264'
import * as MuxStream from '../ext-mod/mux.js/lib/utils/stream';

const MPEG_TS_TIMESCALE_HZ = 90000;

/*
import * as AacStream from '../ext-mod/mux.js/lib/aac';
import {isLikelyAacData} from '../ext-mod/mux.js/lib/aac/utils';
import {ONE_SECOND_IN_TS} from '../ext-mod/mux.js/lib/utils/clock';
*/

const { debug, log, warn } = getLogger('MP2TSDemuxProcessor', LoggerLevel.OFF, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/aac', 'video/aac', 'application/cea-608') // output
  );

type StreamEventData = {
  type: string
}

type Stream = MuxStream & {
  on: (event: string, handler: (data: StreamEventData) => void) => Stream
}

enum M2tNaluType {
  AUD = "access_unit_delimiter_rbsp",
  SPS = "seq_parameter_set_rbsp",
  PPS = "pic_parameter_set_rbsp",
  SEI = "sei_rbsp",
  IDR = "slice_layer_without_partitioning_rbsp_idr"
}

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

type M2tDemuxPipeline = {
  metadataStream: Stream
  packetStream: Stream,
  parseStream: Stream,
  elementaryStream: Stream,
  timestampRolloverStream: Stream,
  adtsStream: Stream,
  h264Stream: Stream,
  captionStream: Stream,
  headOfPipeline: Stream
};

type M2tTrackType = "video" | "audio"

type M2tTrack = {
  codec: "avc" | "adts"
  id: number
  timelineStartInfo: {
    baseMediaDecodeTime: number
  }
  type: M2tTrackType
}

type M2tElementaryStreamEvent = {
  type: "metadata" | M2tTrackType
  dts: number | undefined
  pts: number | undefined
  packetLength: number
  trackId: number
  dataAlignmentIndicator: boolean
  data: Uint8Array
  tracks?: Array<M2tTrack>
}

type M2tH264StreamEvent = {
  type?: "metadata",
  config?: {
    height: number
    width: number
    levelIdc: number
    profileCompatibility: number
    profileIdc: number
    sarRatio: [number, number]
  }
  data: Uint8Array
  escapedRBSP?: Uint8Array
  dts: number
  pts: number
  nalUnitType: M2tNaluType
  trackId: number
}

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
    this._demuxPipeline = pipeline as M2tDemuxPipeline;
    pipeline.metadataStream = new m2ts.MetadataStream();
    // set up the parsing pipeline
    pipeline.packetStream = new m2ts.TransportPacketStream() as unknown as Stream;
    pipeline.parseStream = new m2ts.TransportParseStream() as unknown as Stream;
    pipeline.elementaryStream = new m2ts.ElementaryStream() as unknown as Stream;
    pipeline.timestampRolloverStream = new m2ts.TimestampRolloverStream() as unknown as Stream;
    pipeline.adtsStream = new AdtsStream.default() as unknown as Stream;
    pipeline.h264Stream = new H264Codec.H264Stream() as unknown as Stream;
    pipeline.captionStream = new m2ts.CaptionStream() as unknown as Stream;
    pipeline.headOfPipeline = pipeline.packetStream as unknown as Stream;

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
      .pipe(pipeline.adtsStream);

    pipeline.timestampRolloverStream
      .pipe(pipeline.metadataStream);


    // Hook up CEA-608/708 caption stream
    pipeline.h264Stream.pipe(pipeline.captionStream);

    pipeline.h264Stream.on('data', (data) => {
      log('h264Stream:', data)
      this._handleVideoNalu(data as M2tH264StreamEvent);
    })

    pipeline.elementaryStream.on('data', (data: M2tElementaryStreamEvent) => {

      //log('ES:', data)
      //

      if (data.type === 'metadata') {

      }
    });

  }

  /*
  private _handleAudioNalu(h264Event: M2tAACStreamEvent) {
      // FIXME: move this out of iteration as well as creating BufferProperties once and
      // only mutating where necessary
      const mimeType =  ? CommonMimeTypes.AUDIO_AAC : CommonMimeTypes.AUDIO_MP3;

      if (!esdsAtomData) {
        esdsAtomData = makeEsdsAtomFromMpegAudioSpecificConfigInfoData(new Uint8Array(audioTrackEsInfo.config));

        const esdsAtomBuffer = new BufferSlice(esdsAtomData);
        esdsAtomBuffer.props = new BufferProperties(mimeType);
        esdsAtomBuffer.props.isBitstreamHeader = true;

        esdsAtomBuffer.props.codec = 'aac'; // 'mp4a' // audioTrackEsInfo.codec;
        esdsAtomBuffer.props.elementaryStreamId = audioTrackEsInfo.pid;
        esdsAtomBuffer.props.details.numChannels = audioTrackEsInfo.channelCount;

        const audioConfigPacket = Packet.fromSlice(esdsAtomBuffer, 0);

        audioConfigPacket.setTimescale(90000)

        outputPacketList.push(audioConfigPacket);
      }

      const sampleData: Uint8Array = sample.unit;

      const bufferSlice = new BufferSlice(
        sampleData.buffer.slice(0),
        sampleData.byteOffset,
        sampleData.byteLength);

      bufferSlice.props = new BufferProperties(mimeType, audioTrackEsInfo.samplerate);
      bufferSlice.props.codec = 'aac'; // 'mp4a' // audioTrackEsInfo.codec;
      bufferSlice.props.elementaryStreamId = audioTrackEsInfo.pid;
      bufferSlice.props.details.numChannels = audioTrackEsInfo.channelCount;

      // bufferSlice.props.details.codecConfigurationData = new Uint8Array(audioTrack.config);

      const packet = Packet.fromSlice(bufferSlice, sample.dts, sample.pts - sample.dts); // HACK !!!

      packet.setTimescale(MPEG_TS_TIMESCALE_HZ)

      outputPacketList.push(packet);
  }
  */

  private _handleVideoNalu(h264Event: M2tH264StreamEvent) {

    const bufferSlice = new BufferSlice(
      h264Event.data.buffer.slice(0),
      h264Event.data.byteOffset,
      h264Event.data.byteLength);

    bufferSlice.props = new BufferProperties(
      CommonMimeTypes.VIDEO_H264,
      30, 8, 1, 1
    );

    bufferSlice.props.codec = 'avc'; // avcTrack.codec;
    bufferSlice.props.elementaryStreamId = h264Event.trackId

    bufferSlice.props.isKeyframe = h264Event.nalUnitType === M2tNaluType.IDR;
    bufferSlice.props.isBitstreamHeader = h264Event.nalUnitType === M2tNaluType.SPS || h264Event.nalUnitType === M2tNaluType.PPS; // SPS/PPS

    if (h264Event.config) {
      this._videoConfig = h264Event;
    }

    if (this._videoConfig) {
      bufferSlice.props.details.width = this._videoConfig.config.width
      bufferSlice.props.details.height = this._videoConfig.config.height;
      bufferSlice.props.details.codecProfile = null;
    }

    bufferSlice.props.details.samplesPerFrame = 1;
    bufferSlice.props.details.sequenceDurationInSeconds = 10; // HACK !!!

    bufferSlice.props.tags.add('nalu');

    const naluTag = mapNaluTypeToTag(h264Event.nalUnitType) // may be null for non-IDR-slice
    naluTag && bufferSlice.props.tags.add(naluTag);

    log("Creating packet for AVC NALU data");
    debugNALU(bufferSlice)

    if (this._videoDtsOffset === null) {
      this._videoDtsOffset = h264Event.dts
    }

    const packet = Packet.fromSlice(
      bufferSlice,
      h264Event.dts - this._videoDtsOffset,
      h264Event.pts - h264Event.dts
      );

    packet.setTimestampOffset(this._videoDtsOffset); // check if this works out downstream

    packet.setTimescale(MPEG_TS_TIMESCALE_HZ
      // avcTrackEsInfo.inputTimeScale // TODO: remove 'inputTimeScale' from resulting object
    )

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

      if (p.defaultPayloadInfo.isVideo()) {
        if (!videoSocket) {
          log('creating video output socket')
          this._videoSocket = videoSocket = this.createOutput(SocketDescriptor.fromPayloads([p.defaultPayloadInfo]));
        }

        //p.forEachBufferSlice((bs) => debugNALU(bs));

        debug('transferring video packet to default out');

        if (p.defaultPayloadInfo.isBitstreamHeader) {
          log('found bitstream header part in packet:', p.defaultPayloadInfo.tags)
        }

        videoSocket.transfer(p);
      } else if (p.defaultPayloadInfo.isAudio()) {
        if (!audioSocket) {
          log('creating audio output socket')
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
    log(`feeding demuxer with packet of ${printNumberScaledAtDecimalOrder(inPacket.getTotalBytes(), 6)} Mbytes`)
    const perf = self.performance;
    const startDemuxingMs = perf.now();
    this._demuxPipeline.headOfPipeline.push(inPacket.data[0].getUint8Array());
    const demuxingRunTimeMs = perf.now() - startDemuxingMs;
    log(`got ${this._outPackets.length} output packets from running demuxer (perf-stats: this took ${demuxingRunTimeMs.toFixed(3)} millis doing)`)
    this._onOutPacketsPushed();
    return true;
  }
}
