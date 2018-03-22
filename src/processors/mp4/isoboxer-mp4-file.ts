import {ISOBox, ISOFile, ISOBoxPropertyBag} from './isoboxer-types'

import {MP4Writer} from './isoboxer-mp4-writer'

export const MP4_FULLBOX_FLAG_TRACK_ENABLED: number = 0x000001
export const MP4_FULLBOX_FLAG_TRACK_IN_MOVIE: number = 0x000002
export const MP4_FULLBOX_FLAG_TRACK_IN_PREVIEW: number = 0x000004

export enum MP4MediaHandlerType {
  HINT = 'hint',
  SOUND = 'soun',
  VIDEO = 'vide'
}

export abstract class MP4Container {
  abstract toISOBoxes()
}

export class MP4TrackSample {
  data: Uint8Array
  duration: number = 0
  compositionTimeOffset: number = 0
  // sample flags
  isDependendedOn: boolean = false
  hasDependencies: boolean = false
  hasRedundancy: boolean = false
  isDifferential: boolean = false
  degradationPriority: number = 0
  paddingValue: number

  size(): number {
    return this.data.byteLength
  }

  offset(): number {
    return this.data.byteOffset
  }

  constructor(data: Uint8Array) {
    this.data = data
  }
}

export abstract class MP4Track extends MP4Container {
  constructor(mediaHandlerType: MP4MediaHandlerType, name?: string) {
    super()

    this.handlerType = mediaHandlerType
    if(name) {
      this.name = name
    }
  }

  creationTime: number = Date.now()
  modificationTime: number = Date.now()

  duration: number = -1
  timescale: number = 1

  width: number = 0
  height: number = 0
  trackId: number = 0
  volume: number = 1
  flags: number = MP4_FULLBOX_FLAG_TRACK_ENABLED | MP4_FULLBOX_FLAG_TRACK_IN_MOVIE | MP4_FULLBOX_FLAG_TRACK_IN_PREVIEW
  language: string = 'en'
  handlerType: MP4MediaHandlerType = MP4MediaHandlerType.HINT
  name: string = ""
  codecData: ArrayBuffer = null;

  samples: MP4TrackSample[] = []
}

export class MP4SoundTrack extends MP4Track {
  balance: number = 0

  constructor() {
    super(MP4MediaHandlerType.SOUND)
  }

  toISOBoxes(): ISOBox[] {
    return []
  }
}

export class MP4VideoTrack extends MP4Track {
  graphicsMode: number
  opColor: number

  constructor() {
    super(MP4MediaHandlerType.VIDEO)
  }

  toISOBoxes(): ISOBox[] {
    return []
  }
}

export class MP4HintTrack extends MP4Track {
  constructor() {
    super(MP4MediaHandlerType.HINT)
  }

  toISOBoxes(): ISOBox[] {
    return []
  }
}

export class MP4TrackFragment extends MP4Container {

  baseMediaDecodeTime: number = 0;

  // `trun` box flags
  dataOffsetPresent: boolean;
  firstSampleFlagsPresent: boolean;
  sampleDurationPresent: boolean;
  sampleSizePresent: boolean;
  sampleCTSOffsetsPresent: boolean;

  samples: MP4TrackSample[] = []

  constructor() {
    super()
  }

  toISOBoxes(): ISOBox[] {
    return []
  }
}

export class MP4Fragment extends MP4Container {
  constructor() {
    super()
  }

  toISOBoxes(): ISOBox[] {
    return []
  }

  trackFragments: MP4TrackFragment[] = []
}

export class MP4File extends MP4Container {
  constructor(brand: string, fragmented: boolean = false) {
    super()

    this.majorBrand = brand
    this.compatibleBrands.push(brand)

    if (fragmented) {
      this.fragments = []
    } else {
      this.fragments = null
    }
  }

  compatibleBrands: string[] = []
  majorBrand: string
  minorVersion: number = 0

  creationTime: number = Date.now()
  modificationTime: number = Date.now()

  duration: number = 0

  timescale: number = 1

  tracks: MP4Track[] = []
  fragments: MP4Fragment[] = []

  isFragmented(): boolean {
    return !! (this.fragments && this.fragments.length)
  }

  toISOBoxes(): ISOBox[] {
    const isoBoxes = []

    const file = MP4Writer.createBlankFile()

    const ftyp = MP4Writer.createBox('ftyp', file)
    const moov = MP4Writer.createBox('moov', file)

    const mvhd = MP4Writer.createBox('mvhd', file)
    moov.append(mvhd, null)

    // MVEX box
    if (this.isFragmented()) {
      const mvex = MP4Writer.createBox('mvex', moov)
      const mehd = MP4Writer.createBox('mehd', mvex, null, true)
      const trex = MP4Writer.createBox('trex', mvex, null, true)
    }

    // TRAK boxes
    if (this.tracks) {
      this.tracks.forEach((track) => {
        const trak = MP4Writer.createBox('trak', moov)
        const tkhd = MP4Writer.createBox('tkhd', trak)
        const mdia = MP4Writer.createBox('mdia', trak)
        const mdhd = MP4Writer.createBox('mdhd', trak)
      })
    }

    isoBoxes.push(ftyp, moov)

    if (!this.isFragmented()) {
      const mdat = MP4Writer.createBox('mdat', file)
      isoBoxes.push(mdat)
    }

    return isoBoxes
  }
}
