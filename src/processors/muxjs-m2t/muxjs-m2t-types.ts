import * as MuxStream from '../../ext-mod/mux.js/lib/utils/stream';

export enum M2tNaluType {
  AUD = 'access_unit_delimiter_rbsp',
  SPS = 'seq_parameter_set_rbsp',
  PPS = 'pic_parameter_set_rbsp',
  SEI = 'sei_rbsp',
  IDR = 'slice_layer_without_partitioning_rbsp_idr'
}

export type M2tTransportPacketEvent = {
  type: 'pat' | 'pmt' | 'pes'
  pid: number
  payloadUnitStartIndicator: boolean
  pmtPid?: number,
  programMapTable?: {
    audio: number | null
    video: number | null
    'timed-metadata': {[pid: number]: number}
  }
}

export type M2tTrackType = 'video' | 'audio'

export type M2tTrack = {
  codec: 'avc' | 'adts'
  id: number
  timelineStartInfo: {
    baseMediaDecodeTime: number
  }
  type: M2tTrackType
}

export type M2tElementaryStreamEvent = {
  type: 'metadata' | M2tTrackType
  dts: number | undefined
  pts: number | undefined
  packetLength: number
  trackId: number
  dataAlignmentIndicator: boolean
  data: Uint8Array
  tracks?: Array<M2tTrack>
}

export type M2tH264StreamEvent = {
  type?: 'metadata',
  config?: {
    height: number
    width: number
    levelIdc: number
    profileCompatibility: number
    profileIdc: number
    sarRatio: [number, number]
  }
  data: Uint8Array
  escapedRBSP?: Uint8Array
  dts: number
  pts: number
  nalUnitType: M2tNaluType,
  nalUnitTypeByte: number,
  trackId: number
}

export type M2tADTSStreamEvent = {
  audioobjecttype: number
  channelcount: number
  data: Uint8Array
  dts: number
  pts: number
  sampleCount: number
  samplerate: number
  samplesize: number
  samplingfrequencyindex: number
}

export type M2tStreamEventData = M2tTransportPacketEvent | M2tElementaryStreamEvent | M2tADTSStreamEvent | M2tH264StreamEvent;

export type M2tStream = MuxStream & {
  on: (event: string, handler: (data: M2tStreamEventData) => void) => M2tStream
}

export type M2tDemuxPipeline = {
  metadataStream: M2tStream
  packetStream: M2tStream,
  parseStream: M2tStream,
  elementaryStream: M2tStream,
  timestampRolloverStream: M2tStream,
  aacOrAdtsStream: M2tStream,
  h264Stream: M2tStream,
  captionStream: M2tStream,
  headOfPipeline: M2tStream
};
