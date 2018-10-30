import { ISOBox, ISOFile } from './isoboxer-types';

import { IB_MP4Writer } from './isoboxer-mp4-writer';

export const MP4_FULLBOX_FLAG_TRACK_ENABLED: number = 0x000001;
export const MP4_FULLBOX_FLAG_TRACK_IN_MOVIE: number = 0x000002;
export const MP4_FULLBOX_FLAG_TRACK_IN_PREVIEW: number = 0x000004;

export enum IB_MP4MediaHandlerType {
  HINT = 'hint',
  SOUND = 'soun',
  VIDEO = 'vide'
}

export abstract class IB_MP4Container {
  abstract toISOBoxes()
}

export class IB_MP4TrackSample {
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

  size (): number {
    return this.data.byteLength;
  }

  offset (): number {
    return this.data.byteOffset;
  }

  constructor (data: Uint8Array) {
    this.data = data;
  }
}

export abstract class IB_MP4Track extends IB_MP4Container {
  constructor (mediaHandlerType: IB_MP4MediaHandlerType, name?: string) {
    super();

    this.handlerType = mediaHandlerType;
    if (name) {
      this.name = name;
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
  handlerType: IB_MP4MediaHandlerType = IB_MP4MediaHandlerType.HINT
  name: string = ''
  codecData: ArrayBuffer = null;

  samples: IB_MP4TrackSample[] = []
}

export class IB_MP4SoundTrack extends IB_MP4Track {
  balance: number = 0

  constructor () {
    super(IB_MP4MediaHandlerType.SOUND);
  }

  toISOBoxes (): ISOBox[] {
    return [];
  }
}

export class IB_MP4VideoTrack extends IB_MP4Track {
  graphicsMode: number
  opColor: number

  constructor () {
    super(IB_MP4MediaHandlerType.VIDEO);
  }

  toISOBoxes (): ISOBox[] {
    return [];
  }
}

export class IB_MP4HintTrack extends IB_MP4Track {
  constructor () {
    super(IB_MP4MediaHandlerType.HINT);
  }

  toISOBoxes (): ISOBox[] {
    return [];
  }
}

export class IB_MP4TrackFragment extends IB_MP4Container {
  baseMediaDecodeTime: number = 0;

  // `trun` box flags
  dataOffsetPresent: boolean;
  firstSampleFlagsPresent: boolean;
  sampleDurationPresent: boolean;
  sampleSizePresent: boolean;
  sampleCTSOffsetsPresent: boolean;

  samples: IB_MP4TrackSample[] = []

  constructor () {
    super();
  }

  toISOBoxes (): ISOBox[] {
    return [];
  }
}

export class IB_MP4Fragment extends IB_MP4Container {
  constructor () {
    super();
  }

  toISOBoxes (): ISOBox[] {
    return [];
  }

  trackFragments: IB_MP4TrackFragment[] = []
}

export class IB_MP4File extends IB_MP4Container {
  constructor (brand: string, fragmented: boolean = false) {
    super();

    this.majorBrand = brand;
    this.compatibleBrands.push(brand);

    if (fragmented) {
      this.fragments = [];
    } else {
      this.fragments = null;
    }
  }

  compatibleBrands: string[] = []
  majorBrand: string
  minorVersion: number = 0

  creationTime: number = Date.now()
  modificationTime: number = Date.now()

  duration: number = 0

  timescale: number = 1

  tracks: IB_MP4Track[] = []
  fragments: IB_MP4Fragment[] = []

  isFragmented (): boolean {
    return !!(this.fragments && this.fragments.length);
  }

  toISOBoxes (): ISOBox[] {
    const isoBoxes = [];

    const file = IB_MP4Writer.createBlankFile();

    const ftyp = IB_MP4Writer.createBox('ftyp', file);
    const moov = IB_MP4Writer.createBox('moov', file);

    const mvhd = IB_MP4Writer.createBox('mvhd', file);
    moov.append(mvhd, null);

    // MVEX box
    if (this.isFragmented()) {
      const mvex = IB_MP4Writer.createBox('mvex', moov);
      const mehd = IB_MP4Writer.createBox('mehd', mvex, null, true);
      const trex = IB_MP4Writer.createBox('trex', mvex, null, true);
    }

    // TRAK boxes
    if (this.tracks) {
      this.tracks.forEach((track) => {
        const trak = IB_MP4Writer.createBox('trak', moov);
        const tkhd = IB_MP4Writer.createBox('tkhd', trak);
        const mdia = IB_MP4Writer.createBox('mdia', trak);
        const mdhd = IB_MP4Writer.createBox('mdhd', trak);
      });
    }

    isoBoxes.push(ftyp, moov);

    if (!this.isFragmented()) {
      const mdat = IB_MP4Writer.createBox('mdat', file);
      isoBoxes.push(mdat);
    }

    return isoBoxes;
  }
}
