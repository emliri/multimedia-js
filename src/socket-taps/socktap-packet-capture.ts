import { SocketTapDefault } from '../core/socket-tap';
import { PacketDataModel } from '../core/packet-model';
import { Packet } from '../core/packet';
import { arrayLast, prntprtty } from '../common-utils';

export class SocketTapPacketCapture extends SocketTapDefault {
  constructor (private _ignoreSymbolic: boolean = true,
    private _debugLog: boolean = false) {
    super();
  }

  readonly dataList: PacketDataModel[] = [];

  pushPacket (p: Packet): boolean {
    if (this._ignoreSymbolic && p.isSymbolic()) {
      return true;
    }
    this.dataList.push(PacketDataModel.createFromPacket(p));
    if (this._debugLog) {
      console.debug(prntprtty(arrayLast(this.dataList)));
    }
    return true;
  }

  isClear () {
    return true;
  }

  flush () {
    this.dataList.length = 0;
  }
}
