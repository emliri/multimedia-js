import { Nullable } from "../common-types";
import { Packet } from "./packet";

export interface SocketTap {
  pushPacket(p: Packet): boolean;
  popPacket(): Nullable<Packet>;
  isClear(): boolean;
  flush();
}

export class SocketTapDefault implements SocketTap {
  pushPacket(p: Packet): boolean {
    return true;
  }

  popPacket(): Nullable<Packet> {
    return null;
  }

  isClear(): boolean {
    return true;
  }

  flush() {}
}

export class SocketTapPacketCapture extends SocketTapDefault {

}
