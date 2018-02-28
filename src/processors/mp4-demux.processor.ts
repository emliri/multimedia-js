import {Processor} from '../core/processor';
import {Packet} from '../core/packet';
import {InputSocket, SocketDescriptor, SocketType} from '../core/socket';

import {MP4Parser} from './mp4/mp4-parser'
import { ISOFile, ISOBox } from './mp4/isoboxer-types';

export class MP4DemuxProcessor extends Processor {
    constructor() {
        super();
        this.createInput()
    }

    templateSocketDescriptor(st: SocketType): SocketDescriptor {
      return new SocketDescriptor()
    }

    protected processTransfer_(inS: InputSocket, p: Packet) {

      p.data.forEach((bufferSlice) => {

        const isoFile: ISOFile = MP4Parser.parse(new Uint8Array(bufferSlice.arrayBuffer))
        const movie = isoFile.fetchAll('moov')
        const tracks = isoFile.fetchAll('trak')
        const mediaBoxes: ISOBox[] = []
        tracks.forEach((track) => {
          const mdia = MP4Parser.findSubBoxes(track, 'mdia')[0]
          mediaBoxes.push(mdia)
        })

        const sampleTables: ISOBox[] = []
        mediaBoxes.forEach((mediaBox) => {
          const stbl = MP4Parser.findSubBoxes(mediaBox, 'stbl')[0]
          if (!stbl) {
            throw new Error('No stbl found in mdia box')
          }
          sampleTables.push(stbl)
        })

        const samples = []
        const stsdEntries = []
        sampleTables.forEach((stbl) => {
          const sampleDescription: any = MP4Parser.findSubBoxes(stbl, 'stsd')[0]
          sampleDescription.entries.forEach((stsdEntry) => {
            stsdEntries.push(stsdEntry)
          })

          const dtsToSampleBox: any = MP4Parser.findSubBoxes(stbl, 'stts')[0]
          const sampleToChunkBox = MP4Parser.findSubBoxes(stbl, 'stsc')[0]
          const sampleSizeBox = MP4Parser.findSubBoxes(stbl, 'stsz')[0]
          const chunkOffsetBox = MP4Parser.findSubBoxes(stbl, 'stco')[0]

          dtsToSampleBox.entries.forEach((dtsEntry) => {
            for(let i = 0; i < dtsEntry.count; i++) {

            }
          })
        })

        const codecData: ArrayBuffer[] = []
        stsdEntries.forEach((stsdEntry) => {
          console.log('Found sample-descriptors:', stsdEntry.type)
          if (stsdEntry.type === 'avc1') {
            // extract also video metadata here
            codecData.push(stsdEntry.config)
          } else if (stsdEntry.type === 'mp4a') {
            // extract also audio metadata here
            codecData.push(stsdEntry.esds)
          }
        })

        const fragments = isoFile.fetchAll('moof')
      })

      return true
    }
}
