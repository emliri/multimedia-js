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
  type: "audio"
  channelCount: number
  config: ArrayBuffer,
  codec: string
  container: string
  //dropped: boolean
  //duration: number
  id: number
  inputTimeScale: number
  isAAC: boolean
  //len: number
  //pesData: Uint8Array
  pid: number
  samplerate: number
  samples: MpegTsDemuxerAudioSample[],
  //sequenceNumber: 0
}

export type MpegTsDemuxerVideoTrackElementaryStream = {
  type: "video"
  audFound: true
  codec: string
  container: string
  //dropped: boolean
  //duration: number
  id: number
  inputTimeScale: number
  isAAC: false
  len: number
  //naluState: 0
  //pesData: Uint8Array
  pid: number
  pixelRatio: [number, number]
  samples: MpegTsDemuxerAvcAccessUnit[]
  //sequenceNumber: number
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

  log('will create TSDemuxer instance')

  const demuxer = new TSDemuxer((
    audioTrack: MpegTsDemuxerAudioTrackElementaryStream,
    avcTrack: MpegTsDemuxerVideoTrackElementaryStream,
    /*
    id3Track,
    txtTrack,
    timeOffset,
    contiguous,
    accurateTimeOffset
    */
  ) => {

    log('result callback invoked');

    debug('demuxed audio track info:', audioTrack);
    debug('demuxed AVC track info:', avcTrack);

    let esdsAtomData: ArrayBuffer = null;

    audioTrack.samples.forEach((sample) => {

      // FIXME: move this out of iteration as well as creating BufferProperties once and
      // only mutating where necessary
      const mimeType = audioTrack.isAAC ? CommonMimeTypes.AUDIO_AAC : CommonMimeTypes.AUDIO_MP3;

      if (!esdsAtomData) {
        esdsAtomData = makeEsdsAtomFromMpegAudioSpecificConfigInfoData(new Uint8Array(audioTrack.config));

        const esdsAtomBuffer = new BufferSlice(esdsAtomData)
        esdsAtomBuffer.props = new BufferProperties(mimeType)
        esdsAtomBuffer.props.isBitstreamHeader = true;

        const audioConfigPacket = Packet.fromSlice(esdsAtomBuffer, 0)
      }

      const sampleData: Uint8Array = sample.unit;

      const bufferSlice = new BufferSlice(
        sampleData.buffer.slice(0),
        sampleData.byteOffset,
        sampleData.byteLength);


      bufferSlice.props = new BufferProperties(mimeType, audioTrack.samplerate);
      bufferSlice.props.codec = audioTrack.codec;
      bufferSlice.props.elementaryStreamId = audioTrack.pid;
      bufferSlice.props.details.numChannels = audioTrack.channelCount;

      //bufferSlice.props.details.codecConfigurationData = new Uint8Array(audioTrack.config);

      const packet = Packet.fromSlice(bufferSlice, sample.dts, sample.pts - sample.dts);

      outputPacketList.push(packet);
    });

    const avcSamples: Array<MpegTsDemuxerAvcAccessUnit> = avcTrack.samples;

    avcSamples.forEach((accessUnit, auIndex) => {

      debug('processing sample index:', auIndex)

      const nalUnits: Array<MpegTsDemuxerNALUnit> = accessUnit.units;
      nalUnits.forEach((nalUnit: MpegTsDemuxerNALUnit, naluIndex) => {
        const bufferSlice = new BufferSlice(
          nalUnit.data.buffer.slice(0),
          nalUnit.data.byteOffset,
          nalUnit.data.byteLength);

        bufferSlice.props = new BufferProperties(CommonMimeTypes.VIDEO_H264);

        bufferSlice.props.codec = 'avc1'; // avcTrack.codec;
        bufferSlice.props.elementaryStreamId = avcTrack.pid;

        bufferSlice.props.isKeyframe = (!!accessUnit.key) || nalUnit.type === NALU.IDR; // IDR
        bufferSlice.props.isBitstreamHeader = nalUnit.type === NALU.SPS || nalUnit.type === NALU.PPS; // SPS/PPS

        bufferSlice.props.details.width = avcTrack.width;
        bufferSlice.props.details.height = avcTrack.height;

        // TODO: move this to H264 parse proc
        if (nalUnit.type === NALU.IDR) {
          bufferSlice.props.tags.add('idr');
          debug('tagged IDR slice at NALU index:', naluIndex, 'on access-unit index:', auIndex)
        } else if (nalUnit.type === NALU.SEI) {
          bufferSlice.props.tags.add('sei');
          debug('tagged SEI slice at NALU index:', naluIndex, 'on access-unit index:', auIndex)
        } else if (nalUnit.type === NALU.SPS) {
          bufferSlice.props.tags.add('sps');
          log('tagged SPS slice at NALU index:', naluIndex, 'on access-unit index:', auIndex)
        } else if (nalUnit.type === NALU.PPS) {
          bufferSlice.props.tags.add('pps');
          log('tagged PPS slice at NALU index:', naluIndex, 'on access-unit index:', auIndex)
        }

        bufferSlice.props.tags.add('nalu')

        //debugNALU(bufferSlice)

        const packet = Packet.fromSlice(bufferSlice, accessUnit.dts, accessUnit.pts - accessUnit.dts);

        outputPacketList.push(packet);
      });
    });

    outputPacketList.push(Packet.newFlush());

    return void 0;
  });

  log('will append data to TSDemuxer instance')

  demuxer.reset();
  p.forEachBufferSlice((bufferSlice) => {
    demuxer.append(bufferSlice.getUint8Array(), 0, true, 0);
  });

  log('done appending data to TSDemuxer instance')

  return outputPacketList;
}
