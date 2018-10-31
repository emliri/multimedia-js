import { Processor } from '../core/processor';
import { Packet } from '../core/packet';
import { InputSocket, SocketDescriptor, SocketType, OutputSocket } from '../core/socket';

import { getLogger } from '../logger';

import { createMp4Demuxer, Mp4Demuxer, Track, Frame, TracksHash, Atom } from '../ext-mod/inspector.js/src';

import { PayloadDescriptor } from '../core/payload-description';

import { Mp4Track } from '../ext-mod/inspector.js/src/demuxer/mp4/mp4-track';
import { BufferProperties, BufferSlice } from '../core/buffer';

import { AvcC } from '../ext-mod/inspector.js/src/demuxer/mp4/atoms/avcC';

const { log, warn, error } = getLogger('MP4DemuxProcessor');

export class MP4DemuxProcessor extends Processor {
    private _demuxer: Mp4Demuxer;

    private _trackIdToOutputs: { [id: number] : OutputSocket} = {};

    constructor () {
      super();
      this.createInput();

      this._demuxer = createMp4Demuxer();
    }

    templateSocketDescriptor (st: SocketType): SocketDescriptor {
      return new SocketDescriptor();
    }

    private _ensureOutputForTrack (track: Track): OutputSocket {
      const payloadDescriptor = new PayloadDescriptor(track.mimeType);
      const sd = new SocketDescriptor([
        payloadDescriptor
      ]);

      if (!this._trackIdToOutputs[track.id]) {
        const out = this._trackIdToOutputs[track.id] = this.createOutput(sd);
      }

      return this._trackIdToOutputs[track.id];
    }

    protected processTransfer_ (inS: InputSocket, p: Packet) {
      p.data.forEach((bufferSlice) => {
        this._demuxer.append(bufferSlice.getUint8Array());
        this._demuxer.end();

        const tracks: TracksHash = this._demuxer.tracks;
        const atoms: Atom[] = this._demuxer.getAtoms();

        for (const trackId in tracks) {
          const track: Mp4Track = <Mp4Track> tracks[trackId];

          // track.update();

          log('mime-type:', track.mimeType, track.id, track.getDuration(), track.type, track.getTimescale());

          if (track.isVideo()) {
            log('video-track:', track.getResolution());
          }

          // log('timescale', track.ge)

          log('defaults:', track.getDefaults());

          if (!track.getDefaults()) {
            warn('no track defaults');
          }

          const output: OutputSocket = this._ensureOutputForTrack(track);

          if (track.type === Mp4Track.TYPE_VIDEO) {
            const avcC = (<AvcC> track.getReferenceAtom());

            const sps: Uint8Array[] = avcC.sps;
            const pps: Uint8Array[] = avcC.pps;

            const avcCodecData = avcC.data;

            const initProps: BufferProperties = new BufferProperties();

            initProps.isBitstreamHeader = true;

            /*
            console.log('pushing SPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(sps[0], initProps)));
            console.log('pushing PPS data')
            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(pps[0], initProps)));
            */

            if (!avcCodecData) {
              warn('no codec data found for video track with id:', track.id);
              continue;
            }

            output.transfer(Packet.fromSlice(BufferSlice.fromTypedArray(avcCodecData, initProps)));

            if (avcC.numOfPictureParameterSets > 1 || avcC.numOfSequenceParameterSets > 1) {
              throw new Error('No support for more than one sps/pps pair');
            }
          }

          const props: BufferProperties = new BufferProperties(
            track.mimeType,
            track.getDefaults() ? track.getDefaults().sampleDuration : 0,
            NaN,
            1
          );

          // General time-delta applied to these tracks buffers
          props.timestampDelta = 0;

          track.getFrames().forEach((frame: Frame) => {
            // log('frame:', frame.frameType, frame.bytesOffset, frame.size, frame.getDecodingTimeUs(), frame.getPresentationTimeUs());

            const frameSlice = bufferSlice.unwrap(
              frame.bytesOffset,
              frame.size,
              props
            );

            // console.log(frame.size);

            const p: Packet = Packet.fromSlice(frameSlice);

            // timestamps of this packet
            p.timestamp = frame.getDecodingTimestampInSeconds();
            p.presentationTimeOffset = frame.getPresentationTimestampInSeconds() - frame.getDecodingTimestampInSeconds();

            // console.log(p)
            // console.log(frame.bytesOffset, frame.size);

            output.transfer(p);
          });
        }
      });

      return true;
    }
}
