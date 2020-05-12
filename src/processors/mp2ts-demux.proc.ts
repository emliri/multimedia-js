import { Processor } from '../core/processor';
import { SocketDescriptor, SocketType, InputSocket, OutputSocket, SocketTemplateGenerator } from '../core/socket';
import { Packet } from '../core/packet';
import { getLogger, LoggerLevel } from '../logger';
import { debugAccessUnit, debugNALU } from './h264/h264-tools';
import { printNumberScaledAtDecimalOrder } from '../common-utils';

import * as m2ts from '../ext-mod/mux.js/lib/m2ts/m2ts';
import * as AdtsStream from '../ext-mod/mux.js/lib/codecs/adts.js';
import * as H264Codec from '../ext-mod/mux.js/lib/codecs/h264'

import * as AacStream from '../ext-mod/mux.js/lib/aac';
import {isLikelyAacData} from '../ext-mod/mux.js/lib/aac/utils';
import {ONE_SECOND_IN_TS} from '../ext-mod/mux.js/lib/utils/clock';

import * as MuxStream from '../ext-mod/mux.js/lib/utils/stream';

const { debug, log, warn } = getLogger('MP2TSDemuxProcessor', LoggerLevel.ON, true);

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

export class MP2TSDemuxProcessor extends Processor {

  static getName (): string {
    return 'MP2TSDemuxProcessor';
  }

  /*
  private _programMap: {[pid: number]: OutputSocket} = {};
  private _haveAudio: boolean = false;
  private _haveVideo: boolean = false;
  */
  //private _firstDtsOffset90khz: number | null = null; // WIP: actually build a packet-filter for this which will set each packet time-offset on a sequence

  private _demuxPipeline: M2tDemuxPipeline;
  private _audioSocket: OutputSocket = null;
  private _videoSocket: OutputSocket = null;

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
    })

    pipeline.elementaryStream.on('data', function(data) {

      //log(data)

      if (data.type === 'metadata') {

        log(data)

          //pipeline.h264Stream
          //pipeline.adtsStream

        // emit pmt info
        /*
        self.trigger('trackinfo', {
          hasAudio: !!audioTrack,
          hasVideo: !!videoTrack
        });
        */
      }
    });

  }

  protected processTransfer_ (inS: InputSocket, inPacket: Packet) {

    const perf = self.performance;

    const startDemuxingMs = perf.now()

    log(`feeding demuxer with packet of ${printNumberScaledAtDecimalOrder(inPacket.getTotalBytes(), 6)} Mbytes`)

    this._demuxPipeline.headOfPipeline.push(inPacket.data[0].getUint8Array())

    const outputPackets: Packet[] = [];

    const demuxingRunTimeMs = perf.now() - startDemuxingMs;

    log(`got ${outputPackets.length} output packets from running demuxer (perf-stats: this took ${demuxingRunTimeMs.toFixed(3)} millis doing)`)

    let audioSocket: OutputSocket = this._audioSocket;
    let videoSocket: OutputSocket = this._videoSocket;

    outputPackets.forEach((p: Packet) => {

      //if (this._firstDtsOffset90khz)

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

    return true;
  }
}
