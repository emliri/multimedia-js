import { Nullable } from '../common-types';
import { prntprtty } from '../common-utils';
import { BufferProperties } from './buffer-props';
import { Packet } from './packet';
import { PacketSymbol } from './packet-symbol';

/**
 * Data-model used for metadata serialization (MUST be JSON-stringify-able)
 */
export class PacketDataModel {

  static createFromPacket (p: Packet): PacketDataModel {
    const pdm = new PacketDataModel(
      p.createdAt,
      p.timestamp,
      p.presentationTimeOffset,
      p.timeScale,
      p.timestampOffset,
      p.synchronizationId,
      p.dataSlicesLength,
      p.dataSlicesBytes,
      p.symbol,
      BufferProperties.clone(p.properties)
    );
    return pdm;
  }

  constructor (
    readonly createdAt: number = Date.now(),
    readonly timestamp: number = 0,
    readonly presentationTimeOffset: number = 0,
    readonly timeScale: number = 1,
    readonly timestampOffset: number = 0,
    readonly synchronizationId: number = NaN,
    readonly dataSlicesLength: number = 0,
    readonly dataSlicesBytes: number = 0,
    readonly symbol: PacketSymbol = PacketSymbol.VOID,
    readonly properties: Nullable<BufferProperties> = null
  ) {}

  toString () {
    return prntprtty(this);
  }
}
