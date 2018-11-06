import { EventEmitter } from 'eventemitter3';

import {
  SourceBufferQueue,
  SourceBufferQueueUpdateCallback,
  SourceBufferQueueUpdateCallbackData
} from './source-buffer-queue';

import {getLogger} from '../../logger';

const {error} = getLogger('MediaSourceController');

export enum MediaSourceControllerEvents {
  MEDIA_CLOCK_UPDATED = 'media-clock-updated',
  MEDIA_DURATION_CHANGED = 'media-duration-changed',
  MEDIA_STALLED = 'media-stalling'
}

export class MediaSourceController extends EventEmitter {
  private mediaSource_: MediaSource
  private sourceBufferQueues_: SourceBufferQueue[]
  private mediaDuration_: number
  private mediaClockTime_: number
  private mediaClockLastUpdateTime_: number

  constructor (mediaSource?: MediaSource) {
    super();

    if (!(mediaSource || MediaSource)) {
      throw new Error('Need global default MediaSource constructor or injected interface instance');
    }

    if (!mediaSource) {
      mediaSource = new MediaSource();
    }

    this.mediaSource_ = mediaSource;
    this.sourceBufferQueues_ = [];
    this.mediaDuration_ = null;
    this.mediaClockTime_ = null;
    this.mediaClockLastUpdateTime_ = null;
  }

  get mediaDuration () {
    return this.mediaDuration_;
  }

  get mediaClockTime () {
    return this.mediaClockTime_;
  }

  get mediaSource () {
    return this.mediaSource_;
  }

  get sourceBufferQueues () {
    return this.sourceBufferQueues_;
  }

  addSourceBufferQueue (mimeType: string) {
    if (!MediaSource.isTypeSupported(mimeType)) {
      error('MediaSource not supporting:', mimeType);
      return false;
    }

    if (this.mediaSource.readyState !== 'open') {
      error('MediaSource not open!');
      return false;
    }

    try {
      const sbQueue = new SourceBufferQueue(this.mediaSource, mimeType, null,
        (sbQueue, eventData) => {
          this.onSourceBufferQueueUpdateCb_(sbQueue, eventData);
        });

      // sbQueue.setModeSequential(true);

      this.sourceBufferQueues_.push(sbQueue);
    } catch (err) {
      error(err);
      return false;
    }
    return true;
  }

  hasSourceBufferQueuesForMimeType(mimeType: string): boolean {
    return !!this.getSourceBufferQueuesByMimeType(mimeType).length
  }

  getSourceBufferQueuesByMimeType (mimeType): SourceBufferQueue[] {
    return this.sourceBufferQueues_.filter((sbQ) => {
      return sbQ.mimeType === mimeType;
    });
  }

  getBufferedTimeRanges (mediaOffset) {
    return this.sourceBufferQueues_.map((sbQ) => {
      return sbQ.getBufferedTimeranges(mediaOffset);
    });
  }

  getBufferedTimeRangesFromMediaPosition () {
    return this.sourceBufferQueues_.map((sbQ) => {
      return sbQ.getBufferedTimeranges(this.mediaClockTime);
    });
  }

  updateMediaClockTime (clockTime) {
    const now = Date.now();
    const wallClockDelta = now - this.mediaClockLastUpdateTime_;
    const mediaTimeDelta = clockTime - this.mediaClockTime_;
    const isForwardProgress = mediaTimeDelta > 0;
    if (this.mediaClockTime_ !== clockTime) {
      this.mediaClockTime_ = clockTime;
      this.mediaClockLastUpdateTime_ = now;
      this.emit(MediaSourceControllerEvents.MEDIA_CLOCK_UPDATED, clockTime);

      // detect discontinuities/jitter in playback here
    } else {
      this.emit(MediaSourceControllerEvents.MEDIA_STALLED, clockTime);
    }
  }

  setMediaDuration (duration, forceImmediateUpdate: boolean = false) {
    if (this.mediaDuration_ !== duration) {
      this.mediaDuration_ = duration;

      if (forceImmediateUpdate) {
        this.mediaSource.duration = duration; // TODO: async update
      }

      this.emit(MediaSourceControllerEvents.MEDIA_DURATION_CHANGED, duration);
    }
  }

  onSourceBufferQueueUpdateCb_ (SourceBufferQueue, SourceBufferQueueUpdateCallbackData) {
    // TODO
  }
}
