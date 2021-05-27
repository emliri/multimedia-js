import { Nullable } from '../common-types';
import { BufferProperties } from './buffer-props';
import { Packet } from './packet';
import { PacketSymbol } from './packet-symbol';

/**
 * Data-model used for metadata serialization (MUST be JSON-stringify-able)
 */
export class PacketDataModel {
  static createDefault (): PacketDataModel {
    return new PacketDataModel(
      0, 0, 0, 0, 0, 0, 0, 0,
      null,
      '',
      false
    );
  }

  static createFromPacket (p: Packet): PacketDataModel {
    const pdm = new PacketDataModel(
      p.timestamp,
      p.presentationTimeOffset,
      p.timeScale,
      p.timestampOffset,
      p.synchronizationId,
      p.dataSlicesLength,
      p.dataSlicesBytes,
      p.symbol,
      p.defaultPayloadInfo,
      p.defaultMimeType,
      p.hasDefaultPayloadInfo
    );
    return pdm;
  }

  constructor (
    readonly timestamp: number,
    readonly presentationTimeOffset: number,
    readonly timeScale: number,
    readonly timestampOffset: number,
    readonly synchronizationId: number,
    readonly dataSlicesLength: number = 0,
    readonly dataSlicesBytes: number = 0,
    readonly symbol: PacketSymbol = PacketSymbol.VOID,
    readonly defaultPayloadInfo: Nullable<BufferProperties> = null,
    readonly defaultMimeType: string,
    readonly hasDefaultPayloadInfo: boolean
  ) {}
}
