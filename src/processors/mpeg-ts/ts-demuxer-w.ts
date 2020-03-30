import { CommonMimeTypes } from '../../core/payload-description';
import { Packet } from '../../core/packet';
import { BufferSlice } from '../../core/buffer';

import { getLogger, LoggerLevel } from '../../logger';

import { TSDemuxer } from './ts-demuxer';
import { BufferProperties } from '../../core/buffer-props';
import { NALU } from '../h264/nalu';
import { debugNALU } from '../h264/h264-tools';
import { makeEsdsAtomFromMpegAudioSpecificConfigInfoData } from '../aac/mp4a-audio-specific-config';

const { debug, log } = getLogger('TSDemuxerW', LoggerLevel.ON, true);

const MPEG_TS_TIMESCALE_HZ = 90000;

/**
 * Type definitions for the weakly typed API of the TSDemuxer module we use
 */

export type MpegTsDemuxerNALUnit = {data: Uint8Array, type: number};

export type MpegTsDemuxerAvcAccessUnit = {
  units: MpegTsDemuxerNALUnit[],
  key: Uint8Array,
  pts: number,
  dts: number,
  id: number,
  frame: boolean,
  debug: string
}

export type MpegTsDemuxerAudioSample = {
  pts: number
  dts: number
  unit: Uint8Array
}

export type MpegTsDemuxerAudioTrackElementaryStream = {
  type: 'audio'
  channelCount: number
  config: ArrayBuffer,
  codec: string
  container: string
  // dropped: boolean
  // duration: number
  id: number
  inputTimeScale: number // @deprecated
  isAAC: boolean
  // len: number
  // pesData: Uint8Array
  pid: number
  samplerate: number
  samples: MpegTsDemuxerAudioSample[],
  // sequenceNumber: 0
}

export type MpegTsDemuxerVideoTrackElementaryStream = {
  type: 'video'
  audFound: true
  codec: string
  container: string
  // dropped: boolean
  // duration: number
  id: number
  inputTimeScale: number // @deprecated
  isAAC: false
  len: number
  // naluState: 0
  // pesData: Uint8Array
  pid: number
  pixelRatio: [number, number]
  samples: MpegTsDemuxerAvcAccessUnit[]
  // sequenceNumber: number
  sps: Uint8Array[]
  pps: Uint8Array[]
  height: number
  width: number
}

/**
 *
 * Wrapper to ease usage of our TS-demuxing functionnality that is very weakly type-spec'd.
 *
 * Given a packet of MPEG-TS input data, this function returns a list of timestamped packets containing slices of the ES streams payload
 * and appropriate BufferProps set to them.
 *
 * @param p Input packets of MPEG-TS data
 * @returns Demuxed streams packets with appropriate buffer-properties and timestamps
 */
export function runMpegTsDemux (p: Packet): Packet[] {
  const outputPacketList: Packet[] = [];

  log('will create TSDemuxer instance');

  const demuxer = new TSDemuxer((
    audioTrackEsInfo: MpegTsDemuxerAudioTrackElementaryStream,
    avcTrackEsInfo: MpegTsDemuxerVideoTrackElementaryStream
    /*
    id3Track,
    txtTrack,
    timeOffset,
    contiguous,
    accurateTimeOffset
    */
  ) => {
    log('result callback invoked');

    debug('demuxed audio track info:', audioTrackEsInfo);
    debug('demuxed AVC track info:', avcTrackEsInfo);

    let esdsAtomData: ArrayBuffer = null;

    audioTrackEsInfo.samples.forEach((sample) => {
      // FIXME: move this out of iteration as well as creating BufferProperties once and
      // only mutating where necessary
      const mimeType = audioTrackEsInfo.isAAC ? CommonMimeTypes.AUDIO_AAC : CommonMimeTypes.AUDIO_MP3;

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
    });

    const avcSamples: Array<MpegTsDemuxerAvcAccessUnit> = avcTrackEsInfo.samples;

    const sampleDepth = 8; // TODO: parse SPS i.e move to h264-parse-proc
    const sampleDurationNum = 1;

    // NOTE: we need to use DTS here because PTS is unordered so
    // using two consecutive packets results in an arbitrary time-delta
    // whereas he we have to assume however that packet DTS frequency (DTS-deltas between successive packets)
    // is exactly equal to the framerate. This should be the case always, but must not, because
    // in principle the deltas may vary around the framerate (average on the receiver/decoder buffer/queue size they have to keep the
    // framerate otherwise the sequence could not be decoded in real-time).
    // FIXME: Thus the calculation could be wrong here in certain cases.
    // NOTE: In principle, DTS could even also be anything that preserves decoding order unrelated to the PTS timeplane!
    const sampleRate = Math.round(1 / ((avcSamples[1].dts - avcSamples[0].dts) / MPEG_TS_TIMESCALE_HZ));

    log('estimated video FPS:', sampleRate);

    let videoDtsOffset: number = null;

    avcSamples.forEach((accessUnit, auIndex) => {

      //debug('processing sample index:', auIndex);

      const nalUnits: Array<MpegTsDemuxerNALUnit> = accessUnit.units;
      nalUnits.forEach((nalUnit: MpegTsDemuxerNALUnit, naluIndex) => {
        const bufferSlice = new BufferSlice(
          nalUnit.data.buffer.slice(0),
          nalUnit.data.byteOffset,
          nalUnit.data.byteLength);

        bufferSlice.props = new BufferProperties(CommonMimeTypes.VIDEO_H264,
          sampleRate, sampleDepth, sampleDurationNum, 1);

        bufferSlice.props.codec = 'avc'; // avcTrack.codec;
        bufferSlice.props.elementaryStreamId = avcTrackEsInfo.pid;

        bufferSlice.props.isKeyframe = nalUnit.type === NALU.IDR; // IDR
        bufferSlice.props.isBitstreamHeader = nalUnit.type === NALU.SPS || nalUnit.type === NALU.PPS; // SPS/PPS

        bufferSlice.props.details.width = avcTrackEsInfo.width;
        bufferSlice.props.details.height = avcTrackEsInfo.height;
        bufferSlice.props.details.samplesPerFrame = 1;
        bufferSlice.props.details.codecProfile = null; // FIXME (parse from PPS / move to h264-parse)

        bufferSlice.props.details.sequenceDurationInSeconds = 10; // HACK !!!

        // TODO: move this to H264 parse proc
        if (nalUnit.type === NALU.IDR) {
          bufferSlice.props.tags.add('idr');
          debug('tagged IDR slice at NALU index:', naluIndex, 'on access-unit index:', auIndex);
        } else if (nalUnit.type === NALU.SEI) {
          bufferSlice.props.tags.add('sei');
          debug('tagged SEI slice at NALU index:', naluIndex, 'on access-unit index:', auIndex);
        } else if (nalUnit.type === NALU.SPS) {
          bufferSlice.props.tags.add('sps');
          log('tagged SPS slice at NALU index:', naluIndex, 'on access-unit index:', auIndex);
        } else if (nalUnit.type === NALU.PPS) {
          bufferSlice.props.tags.add('pps');
          log('tagged PPS slice at NALU index:', naluIndex, 'on access-unit index:', auIndex);
        }

        bufferSlice.props.tags.add('nalu');

        log("Creating packet for AVC NALU data");
        debugNALU(bufferSlice)

        if (videoDtsOffset === null) {
          videoDtsOffset = accessUnit.dts;
        }

        const packet = Packet.fromSlice(
          bufferSlice,
          accessUnit.dts - videoDtsOffset,
          accessUnit.pts - accessUnit.dts
          );

        packet.setTimestampOffset(videoDtsOffset);

        packet.setTimescale(MPEG_TS_TIMESCALE_HZ
          // avcTrackEsInfo.inputTimeScale // TODO: remove 'inputTimeScale' from resulting object
        )

        debug('created packet:', packet.toString());

        outputPacketList.push(packet);
      });
    });

    outputPacketList.push(Packet.newFlush());

    return void 0;
  });

  log('will append data to TSDemuxer instance');

  demuxer.reset();
  p.forEachBufferSlice((bufferSlice) => {
    demuxer.append(bufferSlice.getUint8Array(), 0, true, 0);
  });

  log('done appending data to TSDemuxer instance');

  return outputPacketList;
}
