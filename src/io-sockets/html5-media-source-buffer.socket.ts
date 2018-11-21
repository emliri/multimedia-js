import { InputSocket, SocketDescriptor } from '../core/socket';
import { Packet } from '../core/packet';
import { MediaSourceController } from './html5-media-source/media-source-controller';
import { getLogger } from '../logger';

const { log, warn, error } = getLogger('HTML5MediaSourceBufferSocket');

const MEDIA_SOURCE_OPEN_FAILURE_TIMEOUT_MS = 4000;

export class HTML5MediaSourceBufferSocket extends InputSocket {

  private mediaSourceController: MediaSourceController;

  private _readyPromise: Promise<void>;

  constructor (mediaSource: MediaSource, defaultFullMimetype?: string) {
    super((p: Packet) => this._onPacketReceived(p), new SocketDescriptor());

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

      if (defaultFullMimetype) {
        this._enableOneSourceBufferForFullMimetype(defaultFullMimetype);
      }

    });

  }

  whenReady(): Promise<void> {
    return this._readyPromise;
  }

  private _enableOneSourceBufferForFullMimetype(fullMimeType: string): boolean {
    if (this.mediaSourceController.hasSourceBufferQueuesForMimeType(fullMimeType)) {
      return false;
    }

    if (!MediaSource.isTypeSupported(fullMimeType)) {
      error(`MSE API says requested mime-type (${fullMimeType}) is not supported, aborting.`);
      return false;
    }

    log('attempting to create an MSE source-buffer for fully-qualified mime-type:', fullMimeType)

    if (!this.mediaSourceController.addSourceBufferQueue(fullMimeType)) {
      throw new Error('Failed to create SourceBuffer for mime-type: ' + fullMimeType);
    }

    return true;
  }

  private _onPacketReceived (p: Packet): boolean {

    const defaultBufferProps = p.defaultPayloadInfo;

    // TODO: add default handling for this in base-class for easing impl these kind of subclasses
    if (p.isSymbolic()) {
      log('got symbolic packet:', p.symbol);
      return true;
    }

    // TODO: have socket probe check this
    if (!defaultBufferProps) {
      warn('no default buffer props:', p);
      return;
    }

    const fullMimeType = defaultBufferProps.getFullMimeType();

    log('received packet with fully-qualified mime-type:', fullMimeType)

    this._enableOneSourceBufferForFullMimetype(fullMimeType);

    p.forEachBufferSlice((bs) => {

      const buffer = bs.arrayBuffer;

      const sourceBufferQueue = this.mediaSourceController.getSourceBufferQueuesByMimeType(fullMimeType)[0];
      if (!sourceBufferQueue) {
        warn('must previously have created surce-buffer for mime-type: ' + fullMimeType);
        warn('ignoring one packet received');
        return;
      }
      sourceBufferQueue.appendBuffer(buffer, 0);

    })

    return true;
  }

}
