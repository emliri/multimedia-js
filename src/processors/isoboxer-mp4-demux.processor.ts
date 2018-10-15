import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

import { IB_MP4Parser } from './mp4/isoboxer-mp4-parser'
import { ISOFile, ISOBox } from './mp4/isoboxer-types';

import {getLogger} from '../logger'
import { BufferSlice } from '../core/buffer';
import { dispatchAsyncTask } from '../common-utils';

const {log, debug} = getLogger('CodemIsoboxerMP4DemuxProcessor')

export class IsoboxerMP4DemuxProcessor extends Processor {
    constructor() {
      super();
      this.createInput()

      log('created demuxer proc');
    }

    templateSocketDescriptor(st: SocketType): SocketDescriptor {
      return new SocketDescriptor()
    }

    private _parseMp4Data(bufferSlice: BufferSlice) {

      const isoFile: ISOFile = IB_MP4Parser.parse(bufferSlice.getUint8Array())
      const movie = isoFile.fetchAll('moov')
      const tracks = isoFile.fetchAll('trak')
      const mediaBoxes: ISOBox[] = []
      tracks.forEach((track) => {
        const mdia = IB_MP4Parser.findSubBoxes(track, 'mdia')[0]
        mediaBoxes.push(mdia)
      })

      const sampleTables: ISOBox[] = []
      mediaBoxes.forEach((mediaBox) => {
        const stbl = IB_MP4Parser.findSubBoxes(mediaBox, 'stbl')[0]
        if (!stbl) {
          throw new Error('No stbl found in mdia box')
        }
        sampleTables.push(stbl)
      })

      const samples = []
      const stsdEntries = []
      sampleTables.forEach((stbl) => {
        const sampleDescription: any = IB_MP4Parser.findSubBoxes(stbl, 'stsd')[0]
        sampleDescription.entries.forEach((stsdEntry) => {
          stsdEntries.push(stsdEntry)
        })

        const ctsToSampleBox: any = IB_MP4Parser.findSubBoxes(stbl, 'ctts')[0]
        const dtsToSampleBox: any = IB_MP4Parser.findSubBoxes(stbl, 'stts')[0]
        const syncSampleBox: any = IB_MP4Parser.findSubBoxes(stbl, 'stss')[0]

        const sampleToChunkBox = IB_MP4Parser.findSubBoxes(stbl, 'stsc')[0]
        const sampleSizeBox = IB_MP4Parser.findSubBoxes(stbl, 'stsz')[0]
        const chunkOffsetBox = IB_MP4Parser.findSubBoxes(stbl, 'stco')[0]

        debug('CTS-to-sample box', ctsToSampleBox)
        debug('DTS-to-sample box:', dtsToSampleBox)
        debug('Sync-sample box:', syncSampleBox);
        debug('Sample-to-chunk box:', sampleToChunkBox);
        debug('Sample-size box:', sampleSizeBox);
        debug('Chunk-offset box', chunkOffsetBox)

        /*
        dtsToSampleBox.entries.forEach((dtsEntry) => {
          for(let i = 0; i < dtsEntry.count; i++) {

          }
        })
        */
      })

      const codecData: ArrayBuffer[] = []
      stsdEntries.forEach((stsdEntry) => {
        log('Found sample-descriptors:', stsdEntry.type)
        if (stsdEntry.type === 'avc1') {
          // extract also video metadata here
          codecData.push(stsdEntry.config)
        } else if (stsdEntry.type === 'mp4a') {
          // extract also audio metadata here
          codecData.push(stsdEntry.esds)
        }
      })

      const fragments = isoFile.fetchAll('moof');

      log('found fragments (moof boxes) count:', fragments.length);

    }

    protected processTransfer_(inS: InputSocket, p: Packet) {

      log('processing transfer of mp4 bytes:', p.getTotalBytes());

      p.data.forEach((bufferSlice) => {
        dispatchAsyncTask(() => this._parseMp4Data(bufferSlice));
      })
      return true
    }
}
