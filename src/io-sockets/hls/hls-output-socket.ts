import { SeekableOutputSocket, SocketDescriptor, OutputSocket, URLLoadingOutputSocket, SocketEvent } from "../../core/socket";

import { HlsLoader } from "../../../../:rialto/lib/hls-loader";
import { MediaSegment } from "../../../../:rialto/lib/media-segment";
import { getLogger, LoggerLevel } from "../../logger";
import { TimeInterval } from "../../../../:rialto/lib/time-intervals";
import { Packet, PacketSymbol } from "../../core/packet";

const { log } = getLogger('HlsToMediaSourceFlow', LoggerLevel.ON, true);

export class HlsOutputSocket extends OutputSocket implements SeekableOutputSocket, URLLoadingOutputSocket {

  private _hlsLoader: HlsLoader = null;

  constructor() {
    super(SocketDescriptor.fromMimeType('application/vnd.apple.mpegurl'));
  }

  load(url: string): boolean {
    this._hlsLoader = new HlsLoader(url, this._onMediaUpdate.bind(this), this._onMediaSegmentLoaded.bind(this));
    return true;
  }

  seek(start: number, end?: number): boolean {
    this._hlsLoader.getVariantStreams()[0].setFetchTargetRange(new TimeInterval(start, end));
    return true;
  }

  private _onMediaUpdate() {
    log('got variants:', this._hlsLoader.getVariantStreams());
    this._emit(SocketEvent.READY);
  }

  private _onMediaSegmentLoaded(segment: MediaSegment) {
    this.transfer(Packet.fromArrayBuffer(segment.buffer, segment.mimeType));
    this.transfer(Packet.fromSymbol(PacketSymbol.EOS));
  }

}
