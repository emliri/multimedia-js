import { Processor } from "../core/processor";
import { InputSocket, SocketType, SocketDescriptor } from "../core/socket";
import { Packet } from "../core/packet";
import { FFmpegTool, FFmpegConversionTargetInfo } from "./ffmpeg/ffmpeg-tool";
import { BufferSlice } from "../core/buffer";
import { BufferProperties } from "../core/buffer-props";

declare var ffmpeg: any;

export class FFmpegConvertProcessor extends Processor {

  static getName(): string { return "FFmpegConvertProcessor" }

  private ffmpeg_: FFmpegTool = null;

  constructor(
    private _audioConfig: FFmpegConversionTargetInfo = null,
    private _videoConfig: FFmpegConversionTargetInfo = null,
    private _defaultInputFileExt: string = 'dat') {

    super();

    if (!_audioConfig && !_videoConfig) {
      throw new Error('Need at least audio or video config');
    }

    if (!(self as any).ffmpeg) {
      //throw new Error('`ffmpeg` not found in global scope');
      console.warn('`ffmpeg` not found in global scope');
    } else {
      this.ffmpeg_ = new FFmpegTool(ffmpeg);
    }

    this.createInput();
    this.createOutput();
  }

  templateSocketDescriptor(socketType: SocketType) {
    return new SocketDescriptor();
  }

  protected processTransfer_(inS: InputSocket, p: Packet, inputIndex: number): boolean {

    let inputFileExt: string = p.defaultPayloadInfo.getMediaSubtype();
    if (inputFileExt === '*') {
      inputFileExt = this._defaultInputFileExt;
    }

    p.forEachBufferSlice((bs) => {

      const outData: Uint8Array = this.ffmpeg_.convertAVFile(
        bs.getUint8Array(),
        inputFileExt,
        this._audioConfig,
        this._videoConfig);

      if (!outData) {
        return;
      }

      let outputMimeType = null;
      // TODO: improve the mapping here
      if (this._videoConfig) {
        outputMimeType = 'video/' + this._videoConfig.targetFiletypeExt;
      } else if (this._audioConfig) {
        outputMimeType = 'audio/' + this._audioConfig.targetFiletypeExt;
      }

      this.out[0].transfer(
        Packet.fromSlice(BufferSlice.fromTypedArray(outData, new BufferProperties(outputMimeType)))
      );
    });

    return true;
  }
}
