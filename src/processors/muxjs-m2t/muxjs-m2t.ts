import * as AdtsStream from '../../ext-mod/mux.js/lib/codecs/adts.js';
import * as H264Codec from '../../ext-mod/mux.js/lib/codecs/h264';

import { inspect } from '../../ext-mod/mux.js/lib/tools/ts-inspector';

import { M2tNaluType } from './muxjs-m2t-types';

export { AdtsStream };
export { H264Codec };

export {
  ElementaryStream,
  TransportPacketStream,
  TransportParseStream,
  TimestampRolloverStream,
  CaptionStream,
  MetadataStream
} from '../../ext-mod/mux.js/lib/m2ts/m2ts';

export function mapNaluTypeToTag (m2tNaluType: M2tNaluType): string {
  switch (m2tNaluType) {
  case M2tNaluType.AUD: return 'aud'; // TODO: make this stuff enums -> symbols or numbers (use actual NALU type ids)
  case M2tNaluType.SPS: return 'sps';
  case M2tNaluType.PPS: return 'pps';
  case M2tNaluType.SEI: return 'sei';
  case M2tNaluType.IDR: return 'idr';
  default: return null;
  }
}

export type InspectMpegTsPmtInfo = {
  pid: null | number
  table: {[esPid: number]: number}
}

export type InspectMpegTsPacketsResult = {
  pmt: InspectMpegTsPmtInfo
  video?: {pts: number, dts: number}[]
  audio?: {pts: number, dts: number}[]
  firstKeyFrame?: {pts: number, dts: number, type: 'video'}
};

export function inspectMpegTsPackets (bytes: Uint8Array,
  baseTimestamp?: number,
  expectAacEs: boolean = false, persistedPmt: InspectMpegTsPmtInfo = null) {
  return inspect(bytes, baseTimestamp, expectAacEs, persistedPmt);
}
