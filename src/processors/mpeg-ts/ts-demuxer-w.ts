import { CommonMimeTypes } from '../../core/payload-description';
import { Packet } from '../../core/packet';
import { BufferSlice } from '../../core/buffer';

import { getLogger, LoggerLevel } from '../../logger';

import { TSDemuxer } from './ts-demuxer';
import { BufferProperties } from '../../core/buffer-props';

const { debug, log } = getLogger('TSDemuxerW', LoggerLevel.ON, true);

export type MpegTsDemuxerAccessUnit = {data: Uint8Array, type: number};
export type MpegTsDemuxerSample = {units: MpegTsDemuxerAccessUnit[], key: Uint8Array, pts: number, dts: number}

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

      bufferSlice.props.details.codecConfigurationData = audioTrack.config;

      const packet = Packet.fromSlice(bufferSlice, sample.dts, sample.dts - sample.pts);

      outputPacketList.push(packet);
    });

    const avcSamples: Array<MpegTsDemuxerSample> = avcTrack.samples;

    avcSamples.forEach((sample, sampleIndex) => {

      debug('processing sample index:', sampleIndex)

      const accessUnits: Array<MpegTsDemuxerAccessUnit> = sample.units;
      accessUnits.forEach((unit: {data: Uint8Array, type: number}, auIndex) => {
        const bufferSlice = new BufferSlice(
          unit.data.buffer.slice(0),
          unit.data.byteOffset,
          unit.data.byteLength);

        bufferSlice.props = new BufferProperties(CommonMimeTypes.VIDEO_AVC);

        bufferSlice.props.codec = 'avc1'; // avcTrack.codec;
        bufferSlice.props.elementaryStreamId = avcTrack.pid;

        bufferSlice.props.isKeyframe = (!!sample.key) || unit.type === 5; // IDR
        bufferSlice.props.isBitstreamHeader = unit.type === 7 || unit.type === 8; // SPS/PPS

        bufferSlice.props.details.width = avcTrack.width;
        bufferSlice.props.details.height = avcTrack.height;

        if (unit.type === 5) {
          bufferSlice.props.tags.add('idr');
          debug('tagged IDR slice at AU index:', auIndex, 'on sample (AnnexB/NALU) index:', sampleIndex)
        } else if (unit.type === 6) {
          bufferSlice.props.tags.add('sei');
          debug('tagged SEI slice at AU index:', auIndex, 'on sample (AnnexB/NALU) index:', sampleIndex)
        } else if (unit.type === 7) {
          bufferSlice.props.tags.add('sps');
          log('tagged SPS slice at AU index:', auIndex, 'on sample (AnnexB/NALU) index:', sampleIndex)
        } else if (unit.type === 8) {
          bufferSlice.props.tags.add('pps');
          log('tagged PPS slice at AU index:', auIndex, 'on sample (AnnexB/NALU) index:', sampleIndex)
        }

        const packet = Packet.fromSlice(bufferSlice, sample.dts, sample.dts - sample.pts);

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
