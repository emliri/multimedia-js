import { InputSocket, SocketDescriptor } from '../core/socket';
import { Packet } from '../core/packet';
import { MediaSourceController } from './html5-media-source/media-source-controller';
import { SourceBufferQueue } from './html5-media-source/source-buffer-queue';
import { concatArrayBuffers } from '../common-utils';
import { getLogger } from '../logger';

const { log } = getLogger('HTML5MediaSourceBufferSocket');

const MEDIA_SOURCE_OPEN_FAILURE_TIMEOUT_MS = 4000;

export class HTML5MediaSourceBufferSocket extends InputSocket {

  private mediaSourceController: MediaSourceController;
  private sourceBufferQueue: SourceBufferQueue;
  private accuBuffer: ArrayBuffer = null;

  private _readyPromise: Promise<void>;

  constructor (mediaSource: MediaSource, mimeType: string) {
    super((p: Packet) => this.onPacketReceived(p), new SocketDescriptor());

    this._readyPromise = new Promise((resolve, reject) => {

      if (mediaSource.readyState === 'open') {
        resolve();
      } else {

        const mediaSourceFailureTimeout = setTimeout(() => {
          reject("MediaSource open-failure timeout");
        }, MEDIA_SOURCE_OPEN_FAILURE_TIMEOUT_MS);

        mediaSource.addEventListener('sourceopen', () => {
          clearTimeout(mediaSourceFailureTimeout);
          resolve();
        });
      }
    });

    this._readyPromise.then(() => {

      this.mediaSourceController = new MediaSourceController(mediaSource);
      this.mediaSourceController.setMediaDuration(60, true); // HACK !!

      if (!this.mediaSourceController.addSourceBufferQueue(mimeType)) {
        throw new Error('Failed to create SourceBuffer for mime-type: ' + mimeType);
      }

      this.sourceBufferQueue = this.mediaSourceController.sourceBufferQueues[0];
    })

    // log(this.sourceBufferQueue)
    // log(mediaSource, this.mediaSourceController)
  }

  whenReady(): Promise<void> {
    return this._readyPromise;
  }

  private onPacketReceived (p: Packet): boolean {
    const buffer = p.data[0].arrayBuffer;

    /// * This is a nasty debugging hack. We should add a probe/filter to do this
    //
    if (ENABLE_BUFFER_DOWNLOAD_LINK) {
      this.accuBuffer = concatArrayBuffers(this.accuBuffer, buffer);
      const blob = new Blob([this.accuBuffer], { type: 'video/mp4' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a'); // Or maybe get it from the current document
      link.href = objectUrl;
      link.download = `buffer${bufferDownloadCnt++}.mp4`;
      link.innerHTML = '<p>Download buffer</p>';
      document.body.appendChild(link); // Or append it whereever you want
    }
    //* /

    this.mediaSourceController.mediaDuration;
    this.sourceBufferQueue.appendBuffer(buffer, 0);

    return true;
  }
}

var bufferDownloadCnt = 0;
var ENABLE_BUFFER_DOWNLOAD_LINK = false;
