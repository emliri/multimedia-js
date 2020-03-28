import { SeekableOutputSocket, SocketDescriptor, OutputSocket, URLLoadingOutputSocket } from "../../core/socket";

import { HlsLoader } from "../../../../:rialto/lib/hls-loader";
import { MediaSegment } from "../../../../:rialto/lib/media-segment";

export class HlsOutputSocket extends OutputSocket implements SeekableOutputSocket, URLLoadingOutputSocket {

  private _hlsLoader: HlsLoader = null;

  constructor() {
    super(SocketDescriptor.fromMimeType('application/vnd.apple.mpegurl'));
  }

  load(url: string): boolean {
    this._hlsLoader = new HlsLoader(url, (segment: MediaSegment) => {

    });
    return true;
  }

  seek(start: number, end?: number): boolean {
    throw new Error("Method not implemented.");
  }

}
