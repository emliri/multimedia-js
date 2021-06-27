import { OutputSocket, SocketDescriptor, InputSocket } from '../core/socket';
import { Packet } from '../core/packet';

export type AppOutputSocketAsyncFunc = (p: Packet) => Promise<boolean>;
export type AppOutputSocketSyncFunc = (p: Packet) => boolean;

export class AppOutputSocket extends OutputSocket {
  static createAsyncTransferFunc (descriptor: SocketDescriptor, inputSocket?: InputSocket): {func: (p: Packet) => Promise<boolean>, sock: OutputSocket} {
    const socket: AppOutputSocket = new AppOutputSocket(descriptor, inputSocket);
    const func = socket.transfer.bind(socket);
    return {
      func,
      sock: socket
    }
  }

  /*
  static createSyncTransferFunc (descriptor: SocketDescriptor, inputSocket?: InputSocket): (p: Packet) => boolean {
    let socket;
    return (socket = new AppOutputSocket(descriptor, inputSocket)).transferSync.bind(socket);
  }
  */

  constructor (descriptor: SocketDescriptor, inputSocket?: InputSocket) {
    super(descriptor);

    inputSocket && this.connect(inputSocket);
  }
}
