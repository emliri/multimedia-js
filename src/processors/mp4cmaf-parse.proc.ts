import { CommonMimeTypes, InputSocket, Packet, SocketDescriptor, SocketTemplateGenerator, SocketType } from "../..";
import { Nullable } from "../common-types";
import { BufferSlice } from "../core/buffer";
import { BufferProperties } from "../core/buffer-props";
import { Processor } from "../core/processor";
import { ReadableStreamQueueReader } from "../lib/readable-stream";
import { Mp4StreamAdapter } from "./mp4/mp4-stream-adapter";

const getSocketDescriptor: SocketTemplateGenerator =
  SocketDescriptor.createTemplateGenerator(
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MP4), // valid input
    SocketDescriptor.fromMimeTypes(CommonMimeTypes.VIDEO_MP4) // expected output
  );

export type Mp4CmafNetStreamParseOpts = {
  closingAtoms?: string[]
}

export class Mp4CmafNetStreamParseProc extends Processor {

  private _inputQueueReader: Nullable<ReadableStreamQueueReader<Uint8Array>>
    = new ReadableStreamQueueReader();

  private _parser: Mp4StreamAdapter = new Mp4StreamAdapter(
    this._inputQueueReader,
    this._onIsoBoxData,
    this._opts.closingAtoms);

  constructor (private _opts: Mp4CmafNetStreamParseOpts = {}) {
    super();
    this.createInput();
    this.createOutput();
  }

  templateSocketDescriptor (socketType: SocketType): SocketDescriptor {
    return getSocketDescriptor(socketType);
  }

  protected processTransfer_(inS: InputSocket, p: Packet, inputIndex: number): boolean {
    this._inputQueueReader.enqueue(p.data[0].getUint8Array());
    return true;
  }

  private _onIsoBoxData(boxData: Uint8Array | Error,
    boxInfo: [number[], string[]], done: boolean) {
      if (boxData instanceof Error) {
        throw boxData;
      }
      const props = new BufferProperties(CommonMimeTypes.VIDEO_MP4);
      boxInfo[1].forEach(boxType => props.tags.add(boxType));
      const bs = BufferSlice.fromTypedArray(boxData, props);
      this.out[0].transfer(Packet.fromSlice(bs));
  }
}
