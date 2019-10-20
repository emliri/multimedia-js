import { Packet } from '../../core/packet';

import { getLogger } from '../../logger';

const { log } = getLogger('source-buffer-queue');

export type SourceBufferQueueItem = {
  method: string
  arrayBuffer?: ArrayBuffer
  timestampOffset?: number
  start?: number
  end?: number
};

export type SourceBufferQueueUpdateCallbackData = {
  updateTimeMs: number
};

export type SourceBufferQueueUpdateCallback = (SourceBufferQueue, SourceBufferQueueUpdateCallbackData) => void;

export class SourceBufferQueue {
  private updateStartedTime_: number = null;
  private queue_: SourceBufferQueueItem[] = [];

  private bufferedBytesCount_: number = 0;
  private sourceBuffer_: SourceBuffer = null;
  private initialMode_: string = null;

  // private bufferMap_: any[];

  constructor (
    mediaSource: MediaSource,
    private mimeType_: string,
    trackDefaults = null,
    private onUpdate_: SourceBufferQueueUpdateCallback = (() => {})) {
    // this.bufferMap_ = [];

    this.sourceBuffer_ = mediaSource.addSourceBuffer(mimeType_);
    this.initialMode_ = this.sourceBuffer_.mode;

    log('SourceBuffer created with initial mode:', this.initialMode_);

    if (trackDefaults) {
      throw new Error('trackDefaults arg not supported (yet) except null');
      // this.sourceBuffer_.trackDefaults = trackDefaults
    }

    this.sourceBuffer_.addEventListener('updatestart', this.onUpdateStart_.bind(this));
    this.sourceBuffer_.addEventListener('updateend', this.onUpdateEnd_.bind(this));
  }

  get mimeType (): string {
    return this.mimeType_;
  }

  get bufferedBytesCount (): number {
    return this.bufferedBytesCount_;
  }

  /*

    The mode property of the SourceBuffer interface controls whether media segments can be appended to the SourceBuffer in any order, or in a strict sequence.

    The two available values are:

    segments: The media segment timestamps determine the order in which the segments are played. The segments can be appended to the SourceBuffer in any order.
    sequence: The order in which the segments are appended to the SourceBuffer determines the order in which they are played. Segment timestamps are generated automatically for the segments that observe this order.
    The mode value is initially set when the SourceBuffer is created using MediaSource.addSourceBuffer(). If timestamps already exist for the media segments, then the value will be set to segments; if they don't, then the value will be set to sequence.

    If you try to set the mode property value to segments when the initial value is sequence, an error will be thrown. The existing segment order must be maintained in sequence mode. You can, however, change the value from segments to sequence. It just means the play order will be fixed, and new timestamps generated to reflect this.

    This property cannot be changed during while the sourceBuffer is processing either an appendBuffer() or remove() call.

  */

  isInitialModeSequential (): boolean {
    return this.initialMode_ === 'sequence';
  }

  getMode (): string {
    return this.sourceBuffer_.mode;
  }

  setModeSequential (sequentialModeEnable) {
    if (this.isUpdating()) {
      throw new Error('Can not set mode when updating');
    }
    if (!sequentialModeEnable) {
      if (this.isInitialModeSequential()) {
        throw new Error('Can not disable sequential model');
      } else {
        this.sourceBuffer_.mode = 'segments';
      }
    } else {
      this.sourceBuffer_.mode = 'sequence';
    }
  }

  isUpdating (): boolean {
    return this.sourceBuffer_.updating;
  }

  getBufferedTimeranges (mediaTimeOffset /* TODO: implement offset */) {
    return this.sourceBuffer_.buffered;
  }

  getTotalBytesQueued (): number {
    return this.queue_.filter((item) => {
      return item.method === 'appendBuffer';
    }).reduce((accu, item) => {
      return accu + item.arrayBuffer.byteLength;
    }, 0);
  }

  getTotalBytes (): number {
    return this.bufferedBytesCount + this.getTotalBytesQueued();
  }

  getItemsQueuedCount (filterMethod: string): number {
    return this.queue_.filter((item) => {
      if (!filterMethod) {
        return true;
      }
      return filterMethod === item.method;
    }).length;
  }

  appendBuffer (arrayBuffer: ArrayBuffer, timestampOffset: number) {
    this.queue_.push({ method: 'appendBuffer', arrayBuffer, timestampOffset });

    this.tryRunQueueOnce_();
  }

  appendMediaSegment (packet: Packet) {
    const bufferSlice = packet.data[0];

    const start = bufferSlice.props.timestampDelta;
    const end = bufferSlice.props.timestampDelta + bufferSlice.props.getSampleDuration();
    const arrayBuffer = bufferSlice.arrayBuffer;
    const timestampOffset = 0;

    this.queue_.push({ method: 'appendBuffer', start, end, arrayBuffer, timestampOffset });

    this.tryRunQueueOnce_();
  }

  remove (start, end) {
    this.queue_.push({ method: 'remove', start, end });

    this.tryRunQueueOnce_();
  }

  dropAsync () {
    this.queue_.push({ method: 'drop' });

    this.tryRunQueueOnce_();
  }

  drop (immediateAbort) {
    if (immediateAbort && this.isUpdating()) {
      this.sourceBuffer_.abort();
    }
    this.queue_ = [];
  }

  flush () {
    this.remove(0, Infinity);
  }

  dropAndFlush () {
    this.drop(true);
    this.flush();
  }

  /*
  private incrBufferedBytesCnt_ (bytes) {
    this.bufferedBytesCount_ += bytes;
  }

  private decBufferedBytesCnt_ (bytes) {
    this.bufferedBytesCount_ -= bytes;
  }
  */

  private tryRunQueueOnce_ () {
    if (this.isUpdating()) {
      return;
    }

    const item: SourceBufferQueueItem = this.queue_.shift();
    if (!item) {
      return;
    }

    const { method, arrayBuffer, timestampOffset, start, end } = item;

    // this.sourceBuffer_.timestampOffset = timestampOffset

    switch (method) {
    case 'appendBuffer':
      log('appending', this.mimeType, 'buffer of', item.arrayBuffer.byteLength, 'bytes');
      this.sourceBuffer_[method](arrayBuffer);

      // this.incrBufferedBytesCnt_(arrayBuffer.bytesLength);
      // TODO: we need to parse the MP4 here to know what duration it is

      break;
    case 'remove':
      log('pruning', this.mimeType, 'buffer on time-interval', start, '-', end);
      this.sourceBuffer_[method](start, end);
      break;
    case 'drop':
      log('dropping all', this.mimeType, 'source-buffer data...');
      this.drop(false);
      break;
    }
  }

  private onUpdateEnd_ () {
    const updateTimeMs = Date.now() - this.updateStartedTime_;
    const callbackData = {
      updateTimeMs
    };
    this.updateStartedTime_ = null;

    log('done updating', this.mimeType, 'source-buffer, took', callbackData.updateTimeMs, 'ms');

    this.onUpdate_(this, callbackData);

    this.tryRunQueueOnce_();
  }

  private onUpdateStart_ () {
    // log('onUpdateStart_');

    if (this.updateStartedTime_ !== null) {
      throw new Error('updateStartedTime_ should be null');
    }
    this.updateStartedTime_ = Date.now();
  }
}
