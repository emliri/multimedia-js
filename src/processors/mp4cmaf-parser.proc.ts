import { CommonMimeTypes, InputSocket, Packet, SocketDescriptor, SocketTemplateGenerator, SocketType } from "../..";
import { Processor } from "../core/processor";

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MP4), // valid input
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MP4) // expected output
  );

export class Mp4CmafNetworkStreamParserProc extends Processor {

  constructor () {
    super();
    this.createInput();
    this.createOutput();
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_(inS: InputSocket, p: Packet, inputIndex: number): boolean {
    throw new Error("Method not implemented.");
  }
}
