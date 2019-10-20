import { CommonMimeTypes } from '../../core/payload-description';
import { Packet } from '../../core/packet';
import { BufferSlice } from '../../core/buffer';

import { getLogger, LoggerLevel } from '../../logger';

import { TSDemuxer } from './ts-demuxer';
import { BufferProperties } from '../../core/buffer-props';
import { NALU } from '../h264/nalu';
import { debugNALU } from '../h264/h264-tools';

const { debug, log } = getLogger('TSDemuxerW', LoggerLevel.OFF, true);

export type MpegTsDemuxerNALUnit = {data: Uint8Array, type: number};
export type MpegTsDemuxerAccessUnit = {units: MpegTsDemuxerNALUnit[], key: Uint8Array, pts: number, dts: number}

export function runMpegTsDemux (p: Packet): Packet[] {
  const outputPacketList: Packet[] = [];

  log('will create TSDemuxer instance')

  const demuxer = new TSDemuxer((
    audioTrack,
    avcTrack,
    id3Track,
    txtTrack,
    timeOffset,
    contiguous,
    accurateTimeOffset
  ) => {

    log('result callback invoked');

    debug('demuxed audio track info:', audioTrack);
    debug('demuxed AVC track info:', avcTrack);

    audioTrack.samples.forEach((sample) => {
      const unit = sample.unit;

      const bufferSlice = new BufferSlice(
        unit.buffer.slice(0),
        unit.byteOffset,
        unit.byteLength);

      const mimeType = audioTrack.isAAC ? CommonMimeTypes.AUDIO_AAC : CommonMimeTypes.AUDIO_MP3;

      bufferSlice.props = new BufferProperties(mimeType);
      bufferSlice.props.codec = audioTrack.isAAC ? /* audioTrack.codec */ 'mp4a' : 'mp3a'; // FIXME
      bufferSlice.props.elementaryStreamId = audioTrack.pid;

      bufferSlice.props.details.codecConfigurationData = new Uint8Array(audioTrack.config);

      const packet = Packet.fromSlice(bufferSlice, sample.dts, sample.dts - sample.pts);

      outputPacketList.push(packet);
    });

    const avcSamples: Array<MpegTsDemuxerAccessUnit> = avcTrack.samples;

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

        const packet = Packet.fromSlice(bufferSlice, accessUnit.dts, accessUnit.dts - accessUnit.pts);

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
