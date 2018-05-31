import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

import {getLogger} from '../logger'

const {log} = getLogger('MP4DemuxProcessor')

import {createMp4Demuxer, Mp4Demuxer, Track, Frame, TracksHash, Atom} from '../ext-mod/inspector.js/src/index';
import { PayloadDescriptor } from '../core/mime-type';

import { Mp4Track } from '../ext-mod/inspector.js/src/demuxer/mp4/mp4-track';

export class MP4DemuxProcessor extends Processor {

    private _demuxer: Mp4Demuxer;

    constructor() {
        super();
        this.createInput()

        this._demuxer = createMp4Demuxer();
    }

    templateSocketDescriptor(st: SocketType): SocketDescriptor {
      return new SocketDescriptor()
    }

    protected processTransfer_(inS: InputSocket, p: Packet) {

      p.data.forEach((bufferSlice) => {

        this._demuxer.append(bufferSlice.getUint8Array());

        this._demuxer.end();

        const tracks: TracksHash = this._demuxer.tracks;

        const atoms: Atom[] = this._demuxer.getAtoms();

        for (const trackId in tracks) {
          const track: Mp4Track = <Mp4Track> tracks[trackId];

          //track.update();

          log('mime-type:', track.mimeType, track.id, track.getDuration(), track.type, track.getTimescale());

          //log('timescale', track.ge)

          log('defaults', track.getDefaults())

          track.getFrames().forEach((frame: Frame) => {

            log('frame:', frame.frameType, frame.size, frame.timeUs);

          })

          this.createOutput(new SocketDescriptor([
            new PayloadDescriptor(track.mimeType)
          ]));
        }

      })

      return true
    }
}
