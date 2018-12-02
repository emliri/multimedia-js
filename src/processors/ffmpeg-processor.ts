import { Processor } from "../core/processor";
import { InputSocket } from "../core/socket";
import { Packet } from "../core/packet";
import { FFmpegTool, FFmpegConversionTargetInfo } from "./ffmpeg/ffmpeg-tool";
import { BufferSlice } from "../core/buffer";

declare var ffmpeg: any;

export class FFmpegConvertProcessor extends Processor {

  private ffmpeg_: FFmpegTool;

  constructor(
    private _audioConfig: FFmpegConversionTargetInfo = null,
    private _videoConfig: FFmpegConversionTargetInfo = null) {

    super();

    if (!(self as any).ffmpeg) {
      throw new Error('`ffmpeg` not found in global scope');
    }

    this.ffmpeg_ = new FFmpegTool(ffmpeg);

    this.createInput();
    this.createOutput();
  }

  protected processTransfer_(inS: InputSocket, p: Packet, inputIndex: number): boolean {

    p.forEachBufferSlice((bs) => {

      const outData = this.ffmpeg_.convertAVFile(
        bs.getUint8Array(),
        p.defaultPayloadInfo.mimeType,
        this._audioConfig,
        this._videoConfig);

      this.out[0].transfer(
        Packet.fromSlice(BufferSlice.fromTypedArray(outData))
      );

    });


    return true;
  }
}
