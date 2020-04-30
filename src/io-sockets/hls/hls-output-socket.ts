import { HlsLoader } from "../../ext-mod/emliri-es-libs/:rialto/lib/hls-loader";
import { MediaSegment } from "../../ext-mod/emliri-es-libs/:rialto/lib/media-segment";
import { TimeInterval } from "../../ext-mod/emliri-es-libs/:rialto/lib/time-intervals";

import { SeekableOutputSocket, SocketDescriptor, OutputSocket, URLLoadingOutputSocket } from "../../core/socket";
import { Packet, PacketSymbol } from "../../core/packet";

import { getLogger, LoggerLevel } from "../../logger";

const { log } = getLogger('HlsToMediaSourceFlow', LoggerLevel.ON, true);

export class HlsOutputSocket extends OutputSocket implements SeekableOutputSocket, URLLoadingOutputSocket {

  private _hlsLoader: HlsLoader = null;
  private _ready: Promise<void>;

  constructor() {
    super(SocketDescriptor.fromMimeType('application/vnd.apple.mpegurl'));
  }

  load(url: string): boolean {
    this._ready = new Promise((resolve, reject) => {
      this._hlsLoader = new HlsLoader(url, () => {
        this._onMediaUpdate();
        resolve();
      }, this._onMediaSegmentLoaded.bind(this));
    });
    return true;
  }

  seek(start: number, end?: number): boolean {
    this._hlsLoader.getVariantStreams()[0].setFetchTargetRange(new TimeInterval(start, end));
    return true;
  }

  whenReady() {
    return this._ready;
  }

  private _onMediaUpdate() {
    log('got variants:', this._hlsLoader.getVariantStreams());
  }

  private _onMediaSegmentLoaded(segment: MediaSegment) {
    this.transfer(Packet.fromArrayBuffer(segment.buffer, segment.mimeType));
    this.transfer(Packet.fromSymbol(PacketSymbol.EOS));
  }

}
