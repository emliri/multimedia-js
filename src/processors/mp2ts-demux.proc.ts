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

import {
  M2tDemuxPipeline,
  M2tH264StreamEvent,
  M2tStream,
  M2tADTSStreamEvent,
  M2tPacketStreamProgramTableEvent,
  M2tNaluType,
  M2tElementaryStreamEvent
} from './muxjs-m2t/muxjs-m2t-types';

import {
  TransportPacketStream,
  TransportParseStream,
  ElementaryStream,
  TimestampRolloverStream,
  AdtsStream,
  H264Codec,
  mapNaluTypeToTag
} from './muxjs-m2t/muxjs-m2t';

const { debug, log, info, warn } = getLogger('Mp2tsDemuxProc', LoggerLevel.OFF, true);

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes('video/mp2t'), // valid inputs
    SocketDescriptor.fromMimeTypes('audio/mpeg', 'audio/adts', 'video/h264', 'application/cea-608') // output
  );

type VideoNALUInfo = {
  nalu: M2tH264StreamEvent,
  dts: number, cto: number,
  isKeyframe: boolean,
  isHeader: boolean
};

export class MP2TSDemuxProcessor extends Processor {
  static getName (): string {
    return 'Mp2tsDemuxProc';
  }

  private _demuxPipeline: M2tDemuxPipeline;

  private _pmtCache: M2tPacketStreamProgramTableEvent;

  private _audioSocket: OutputSocket = null;
  private _audioDtsOffset: number = null;

  private _videoSocket: OutputSocket = null;
  private _videoFirstKeyFrameDts: number = null;
  private _videoConfig: M2tH264StreamEvent = null;
  private _gotVideoPictureParamSet: boolean = false;
  private _videoNaluQueueOut: VideoNALUInfo[] = [];

  private _metadataSocketMap: {[pid: number]: OutputSocket} = {};

  private _outPackets: Packet[] = [];

  constructor () {
    super();
    this.createInput();

    this._setupPipeline();
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  private _setupPipeline () {
    const pipeline: Partial<M2tDemuxPipeline> = {};

    // set up the parsing pipeline
    pipeline.packetStream = new TransportPacketStream() as unknown as M2tStream;
    pipeline.parseStream = new TransportParseStream() as unknown as M2tStream;
    pipeline.elementaryStream = new ElementaryStream() as unknown as M2tStream;
    pipeline.timestampRolloverStream = new TimestampRolloverStream(null) as unknown as M2tStream;

    // payload demuxers
    // eslint-disable-next-line new-cap
    pipeline.aacOrAdtsStream = new AdtsStream.default() as unknown as M2tStream;
    pipeline.h264Stream = new H264Codec.H264Stream() as unknown as M2tStream;
    // easy handle to headend of pipeline
    pipeline.headOfPipeline = pipeline.packetStream as unknown as M2tStream;

    // disassemble MPEG2-TS packets into elementary streams
    pipeline.packetStream
      .pipe(pipeline.parseStream)
      .pipe(pipeline.elementaryStream)
      .pipe(pipeline.timestampRolloverStream);

    pipeline.parseStream.on('data', (data: M2tPacketStreamProgramTableEvent) => {
      if (!this._pmtCache && data.type === 'pmt') {
        log('First PMT packet:', data);
        this._pmtCache = data;
        const avMimeTypes: MimetypePrefix[] = [];
        if (data.programMapTable?.audio) {
          avMimeTypes.push(MimetypePrefix.AUDIO);
        }
        if (data.programMapTable?.video) {
          avMimeTypes.push(MimetypePrefix.VIDEO);
        }
        this.emitEvent(ProcessorEvent.OUTPUT_SOCKET_SHADOW, {
          socket: new ShadowOutputSocket(avMimeTypes)
        });

        Object.keys(data.programMapTable['timed-metadata']).forEach((pid: string) => {
          const streamType: number = data.programMapTable['timed-metadata'][pid];
          // TODO: extract stream-descriptors from PMT data
          this.emitEvent(ProcessorEvent.OUTPUT_SOCKET_SHADOW, {
            socket: new ShadowOutputSocket([MimetypePrefix.APPLICATION], Number(pid))
          });
        });
      }
    });

    pipeline.elementaryStream.on('data', (eventData: M2tElementaryStreamEvent) => {
      if (!this._pmtCache) return;

      const { data, pts, dts, trackId } = eventData;

      const appDataStreamType =
        this._pmtCache.programMapTable['timed-metadata'][trackId];
      // assert program stream-type
      if (!appDataStreamType) {
        // warn('timed-metadata PID not mapped in stream-types supported (ignoring payload):', trackId);
        return;
      }

      // create packet
      let packet: Packet;
      const bs = BufferSlice.fromTypedArray(data,
        new BufferProperties(MimetypePrefix.APPLICATION + '/unknown'));
      const timestamp = Number.isFinite(dts) ? dts : pts;
      if (Number.isFinite(timestamp)) {
        packet = Packet.fromSlice(bs, timestamp);
      } else {
        packet = Packet.fromSlice(bs);
      }
      packet.setSynchronizationId(trackId);
      // create output on first data
      if (!this._metadataSocketMap[trackId]) {
        this._metadataSocketMap[trackId] =
          this.createOutput(SocketDescriptor
            .fromBufferProps(packet.properties));
      }
      // transfer packet
      this._metadataSocketMap[trackId].transfer(packet);
    });

    // demux the streams
    pipeline.timestampRolloverStream
      .pipe(pipeline.h264Stream);

    pipeline.timestampRolloverStream
      .pipe(pipeline.aacOrAdtsStream);

    pipeline.h264Stream.on('data', (data: M2tH264StreamEvent) => {
      debug('h264Stream:', data);
      this._handleVideoNalu(data);
    });

    pipeline.aacOrAdtsStream.on('data', (data: M2tADTSStreamEvent) => {
      debug('aacOrAdtsStream:', data);
      this._handleAudioNalu(data);
    });

    this._demuxPipeline = pipeline as M2tDemuxPipeline;
  }

  private _handleAudioNalu (adtsEvent: M2tADTSStreamEvent) {
    const dts = adtsEvent.dts - this._audioDtsOffset;
    const cto = adtsEvent.pts - adtsEvent.dts;

    const sampleData: Uint8Array = adtsEvent.data;

    const bufferSlice = new BufferSlice( // fromTypedArray
      sampleData.buffer,
      sampleData.byteOffset,
      sampleData.byteLength);

    const packet = Packet.fromSlice(bufferSlice,
      dts,
      cto
    );

    const mimeType = CommonMimeTypes.AUDIO_AAC;

    // NOTE: buffer-props is per-se not cloned on packet transfer,
    // so we must create/ref a single prop-object per packet (full-ownership).
    bufferSlice.props = new BufferProperties(mimeType, adtsEvent.samplerate, 16, 1); // Q: is it always 16 bit ?
    bufferSlice.props.samplesCount = adtsEvent.sampleCount;
    bufferSlice.props.codec = CommonCodecFourCCs.mp4a;
    bufferSlice.props.isKeyframe = true;
    bufferSlice.props.isBitstreamHeader = false;
    bufferSlice.props.details.samplesPerFrame = 1024; // AAC has constant samples-per-frame rate of 1024
    bufferSlice.props.details.codecProfile = adtsEvent.audioobjecttype;
    bufferSlice.props.details.numChannels = adtsEvent.channelcount;

    // TODO: compute bitrate
    // bufferSlice.props.details.constantBitrate =

    if (this._audioDtsOffset === null) {
      // this._audioDtsOffset = adtsEvent.dts
      this._audioDtsOffset = 0;
    }

    // packet.setTimestampOffset(this._audioDtsOffset);
    packet.setTimescale(MPEG_TS_TIMESCALE_HZ);

    this._outPackets.push(packet);
  }

  private _handleVideoNalu (h264Event: M2tH264StreamEvent) {
    if (h264Event.config) {
      this._videoConfig = h264Event;
      info('Got video codec config slice:',
        this._videoConfig,
        mpeg2TsClockToSecs(this._videoConfig.dts), '[s]');
      info('Parsed SPS:', H264ParameterSetParser.parseSPS(this._videoConfig.data.subarray(1)));
    }

    if (!this._videoConfig) {
      warn('Skipping H264 data before got first param-sets, NALU-type:', H264NaluType[h264Event.nalUnitTypeByte]);
      return;
    }

    // drop "filler data" nal-units (used by some encoders on CBR channels)
    if (h264Event.nalUnitTypeByte === H264NaluType.FIL) {
      return;
    }

    /*
    if (h264Event.nalUnitTypeByte === H264NaluType.SEI) {
      // need pass on SEI to app
      return;
    }
    //*/

    if (h264Event.nalUnitTypeByte === H264NaluType.PPS) {
      this._gotVideoPictureParamSet = true;
    }

    const isKeyframe: boolean = h264Event.nalUnitTypeByte === H264NaluType.IDR;
    if (isKeyframe) {
      if (this._videoFirstKeyFrameDts === null) {
        this._videoFirstKeyFrameDts = h264Event.dts;
      }
      if (!this._gotVideoPictureParamSet) {
        warn('Got IDR without previously seeing a PPS NALU');
      }
    }

    const isHeader: boolean = h264Event.nalUnitTypeByte === H264NaluType.SPS ||
                              h264Event.nalUnitTypeByte === H264NaluType.PPS;

    const dts = h264Event.dts;
    const cto = h264Event.pts - h264Event.dts;

    this._pushVideoNalu({ nalu: h264Event, dts, cto, isKeyframe, isHeader });
  }

  private _pushVideoNalu (nalInfo: VideoNALUInfo) {
    const { isHeader: nextIsHeader, isKeyframe: nextIsKeyFrame } = nalInfo;
    const naluQLen = this._videoNaluQueueOut.length;
    const nextIsAuDelimiter = nalInfo.nalu.nalUnitType === M2tNaluType.AUD;
    const firstIsAuDelimiter = naluQLen
      ? this._videoNaluQueueOut[0].nalu.nalUnitType === M2tNaluType.AUD
      : false;
    const lastIsAuDelimiter = naluQLen
      ? this._videoNaluQueueOut[naluQLen - 1].nalu.nalUnitType === M2tNaluType.AUD
      : false;
    const hasIncrPts = naluQLen
      ? nalInfo.nalu.pts > this._videoNaluQueueOut[naluQLen - 1].nalu.pts
      : false;

    const needQueueFlushNoAud = (hasIncrPts && !nextIsKeyFrame &&
      !(firstIsAuDelimiter || lastIsAuDelimiter || nextIsAuDelimiter));

    const needQueueFlush = naluQLen &&
                          (
                            needQueueFlushNoAud ||
                            // seperate by AUD always
                            nextIsAuDelimiter ||
                            (!lastIsAuDelimiter &&
                              ((this._videoNaluQueueOut[0].isHeader && !nextIsHeader) ||
                                (!this._videoNaluQueueOut[0].isHeader && nextIsHeader))));

    if (needQueueFlush) {
      this._flushVideoNaluQueueOut();
    }
    this._videoNaluQueueOut.push(nalInfo);
  }

  private _flushVideoNaluQueueOut () {
    const { dts, cto, nalu } = this._videoNaluQueueOut[0];

    const props = new BufferProperties(
      CommonMimeTypes.VIDEO_H264
    );
    props.samplesCount = 1;

    props.codec = CommonCodecFourCCs.avc1;
    props.elementaryStreamId = nalu.trackId;

    props.details.width = this._videoConfig.config.width;
    props.details.height = this._videoConfig.config.height;
    props.details.codecProfile = this._videoConfig.config.profileIdc;

    props.details.samplesPerFrame = 1;

    props.tags.add('nalu');
    // add NALU type tags for all slices & apply all props flags
    this._videoNaluQueueOut.forEach(({ nalu, isHeader, isKeyframe }) => {
      if (isHeader) {
        props.isBitstreamHeader = true;
      }
      if (isKeyframe) {
        props.isKeyframe = true;
      }
      const naluTag = mapNaluTypeToTag(nalu.nalUnitType);
      if (naluTag) {
        props.tags.add(naluTag);
      }
    });

    // create multi-slice packet
    const slices = this._videoNaluQueueOut.map(({ nalu }) => {
      const bs = new BufferSlice(
        nalu.data.buffer,
        nalu.data.byteOffset,
        nalu.data.byteLength,
        props // share same props for all slices
      );
      debugNALU(bs, debug);
      return bs;
    });

    const packet = Packet.fromSlices(
      dts,
      cto,
      ...slices
    );

    packet.setTimescale(MPEG_TS_TIMESCALE_HZ);
    debug('created/pushed packet:', packet.toString(),
      `(${packet.getTotalBytes()} bytes in ${packet.dataSlicesLength} buffer-slices)`);
    this._outPackets.push(packet);

    this._videoNaluQueueOut.length = 0;
  }

  private _onOutPacketsPushed () {
    const outputPackets: Packet[] = this._outPackets;

    let audioSocket: OutputSocket = this._audioSocket;
    let videoSocket: OutputSocket = this._videoSocket;

    outputPackets.forEach((p: Packet) => {
      if (p.isSymbolic()) {
        throw new Error('Unexpected: got symbolic packet: ' + p.getSymbolName());
      }
      if (!p.properties) {
        throw new Error('Unexpected:  Packet has not payload-description: ' + p.toString());
      }
      const { properties } = p;

      debug(`processing packet of ${p.getTotalBytes()} bytes`);

      // TODO: make two queues (audio/video) and optimize away this check here

      if (properties.isVideo()) {
        debug('got video out to transfer:', p.toString());

        if (!videoSocket) {
          log('creating video output socket:', properties.mimeType);
          this._videoSocket = videoSocket = this.createOutput(SocketDescriptor.fromBufferProps(properties));
        }

        if (properties.isBitstreamHeader) {
          log('found bitstream header part in packet:', properties.tags, p.data);
        }

        videoSocket.transfer(p);

      // TODO: make two queues (audio/video) and optimize away this check here
      } else if (properties.isAudio()) {
        debug('got audio out to transfer:', p.toString());

        if (!audioSocket) {
          log('creating audio output socket:', properties.mimeType);
          this._audioSocket = audioSocket = this.createOutput(SocketDescriptor.fromBufferProps(properties));
        }

        audioSocket.transfer(p);
      } else {
        throw new Error('Unsupported payload: ' + properties.mimeType);
      }
    });

    this._outPackets.length = 0; // clear queue
  }

  protected processTransfer_ (inS: InputSocket, inPacket: Packet) {
    log(`feeding demuxer with chunk of ${printNumberScaledAtDecimalOrder(inPacket.getTotalBytes(), 3)} Kbytes`);
    const startDemuxingMs = getPerfNow();
    this._demuxPipeline.headOfPipeline.push(inPacket.data[0].getUint8Array());
    const demuxingRunTimeMs = getPerfNow() - startDemuxingMs;
    log(`got ${this._outPackets.length} output packets from running demuxer (perf-stats: this took ${demuxingRunTimeMs.toFixed(3)} millis doing)`);
    this._onOutPacketsPushed();
    return true;
  }
}
