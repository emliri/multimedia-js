import {OutputSocket, SocketDescriptor} from '../core/socket'
import { Packet } from '../core/packet';

class FileOutSocket extends OutputSocket {
  constructor() {
    super(new SocketDescriptor())
  }

  transfer(p: Packet): boolean {
    return true;
  }
}
