import { WorkerTask, postMessage } from '../../core/worker';
import { CommonMimeTypes } from '../../core/payload-description';
import { Packet, PacketSymbol } from '../../core/packet';
import { BufferSlice } from '../../core/buffer';

import { getLogger } from '../../logger';

import { TSDemuxer } from './ts-demuxer';

const {log} = getLogger('TSDemuxerTask');

export function processTSDemuxerAppend (task: WorkerTask) {

  const demuxer = new TSDemuxer((
    audioTrack,
    avcTrack,
    id3Track,
    txtTrack,
    timeOffset,
    contiguous,
    accurateTimeOffset
    ) => {

    log(audioTrack, avcTrack);

    audioTrack.samples.forEach((sample) => {

      const unit = sample.unit;

      const bufferSlice = new BufferSlice(
        unit.buffer.slice(0),
        unit.byteOffset,
        unit.byteLength);

      bufferSlice.props.codec = audioTrack.isAAC ? audioTrack.codec : 'mp3a'; // FIXME
      bufferSlice.props.mimeType = audioTrack.isAAC ? CommonMimeTypes.AUDIO_AAC : CommonMimeTypes.AUDIO_MP3;
      bufferSlice.props.elementaryStreamId = audioTrack.pid;

      bufferSlice.props.details.codecConfigurationData = audioTrack.config;

      const packet = Packet.fromSlice(bufferSlice, sample.dts, sample.dts - sample.pts);

      postMessage(task.workerContext, {
        packet
      });

    });

    avcTrack.samples.forEach((sample) => {

      sample.units.forEach((unit: {data: Uint8Array, type: number}) => {
        const bufferSlice = new BufferSlice(
          unit.data.buffer.slice(0),
          unit.data.byteOffset,
          unit.data.byteLength);

        bufferSlice.props.codec = avcTrack.codec;
        bufferSlice.props.mimeType = CommonMimeTypes.VIDEO_AVC;
        bufferSlice.props.elementaryStreamId = avcTrack.pid;

        bufferSlice.props.isKeyframe = sample.key || unit.type === 5; // IDR
        bufferSlice.props.isBitstreamHeader = unit.type >= 7 && unit.type <= 8; // SPS/PPS

        bufferSlice.props.details.width = avcTrack.width;
        bufferSlice.props.details.height = avcTrack.height;

        if (unit.type === 5) {
          bufferSlice.props.tags.add('idr');
        } else if (unit.type === 6) {
          bufferSlice.props.tags.add('sei');
        } else if (unit.type === 7) {
          bufferSlice.props.tags.add('sps');
        } else if (unit.type === 8) {
          bufferSlice.props.tags.add('pps');
        }

        const packet = Packet.fromSlice(bufferSlice, sample.dts, sample.dts - sample.pts);

        postMessage(task.workerContext, {
          packet
        });

      });
    });

    postMessage(task.workerContext, {
      packet: Packet.fromSymbol(PacketSymbol.FLUSH)
    });

    return void 0;
  });

  demuxer.reset();

  const p = Packet.fromTransferable(task.packet);

  p.forEachBufferSlice((bufferSlice) => {
    demuxer.append(bufferSlice.getUint8Array(), 0, true, 0);
  });
}
