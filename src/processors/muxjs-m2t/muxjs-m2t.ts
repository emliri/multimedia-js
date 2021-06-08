import * as AdtsStream from '../../ext-mod/mux.js/lib/codecs/adts.js';
import * as H264Codec from '../../ext-mod/mux.js/lib/codecs/h264';
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
