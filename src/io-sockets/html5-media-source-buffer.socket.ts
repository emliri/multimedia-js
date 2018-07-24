import { InputSocket, SocketDescriptor } from "../core/socket";
import { Packet } from "../core/packet";
import { MediaSourceController } from "./html5-media-source/media-source-controller";
import { SourceBufferQueue } from "./html5-media-source/source-buffer-queue";

export class HTML5MediaSourceBufferSocket extends InputSocket {
  private mediaSourceController: MediaSourceController;
  private sourceBufferQueue: SourceBufferQueue;

  private accuBuffer: ArrayBuffer = null;

  constructor(mediaSource: MediaSource, mimeType: string) {
    super((p: Packet) => this.onPacketReceived(p), new SocketDescriptor());

    if (mediaSource.readyState !== 'open') {
      throw new Error('MediaSource not open!');
    }

    this.mediaSourceController = new MediaSourceController(mediaSource);
    if(!this.mediaSourceController.addSourceBufferQueue(mimeType)) {
      throw new Error('Failed to create SourceBuffer for mime-type: ' + mimeType);
    }

    this.sourceBufferQueue = this.mediaSourceController.sourceBufferQueues[0];
  }

  private onPacketReceived(p: Packet): boolean {
    const buffer = p.data[0].arrayBuffer

    this.accuBuffer = concatArrayBuffers(this.accuBuffer, buffer)

    const blob = new Blob([this.accuBuffer], {type: "video/mp4"});
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a"); // Or maybe get it from the current document
    link.href = objectUrl;
    link.download = "buffer.mp4";
    link.innerHTML = "<p>Download buffer</p>";
    document.body.appendChild(link); // Or append it whereever you want

    this.sourceBufferQueue.appendBuffer(p.data[0].arrayBuffer, 0);

    return true;
  }
}

var concatArrayBuffers = function(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  if (!buffer1) {
    return buffer2;
  } else if (!buffer2) {
    return buffer1;
  }
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
};
