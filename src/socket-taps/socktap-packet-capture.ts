import { SocketTapDefault } from '../core/socket-tap';
import { PacketDataModel } from '../core/packet-model';
import { Packet } from '../core/packet';

export class SocketTapPacketCapture extends SocketTapDefault {
  readonly dataList: PacketDataModel[] = [];

  pushPacket (p: Packet): boolean {
    this.dataList.push(PacketDataModel.createFromPacket(p));
    return true;
  }

  isClear () {
    return true;
  }

  flush () {
    this.dataList.length = 0;
  }
}
