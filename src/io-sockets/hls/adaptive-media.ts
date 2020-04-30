import { CloneableScaffold } from "./cloneable";

import {MediaSegment} from './media-segment'

import {
  VideoInfo,
  AudioInfo,
  TextInfo,
  MediaTypeFlag,
  MediaContainer,
  MediaContainerInfo,
  MediaTypeSet
} from './media-container-info'

import { ByteRange } from './byte-range';
import { AdaptiveMediaEngine } from './adaptive-media-client';
import { MediaClockTime } from "./media-locator";
import { TimeIntervalContainer, TimeInterval } from "./time-intervals";
import { getLogger } from "../../logger";

const { log, error, warn } = getLogger("adaptive-media-client");

/**
 * Essentially, a sequence of media segments that can be consumed as a stream.
 *
 * Represents what people refer to as rendition, quality level or representation, or media "variant" playlist.
 *
 * Contains an array of segments and the metadata in common about these.
 */
export class AdaptiveMedia extends CloneableScaffold<AdaptiveMedia> {

  private _segments: MediaSegment[] = [];
  private _timeRanges: TimeIntervalContainer = new TimeIntervalContainer();
  private _lastRefreshAt: number = 0;
  private _lastTimeRangesCreatedAt: number = 0;
  private _updateTimer: number;

  constructor(public mediaEngine: AdaptiveMediaEngine = null) {
    super();
  }

  parent: AdaptiveMediaSet

  mimeType: string
  codecs: string
  bandwidth: number
  videoInfo: VideoInfo
  audioInfo: AudioInfo
  textInfo: TextInfo

  isLive: boolean = false;

  /**
   * Some label indentifying the logical function for the user this media selection has. HLS uses `NAME`, DASH has `role(s)`.
   *
   * This SHOULD be identical for redundant selections/streams (carrying the same content but in different sets to allow
   * backup / fallback strategies).
   *
   * It SHOULD be different for streams with different function or "role" (as in DASH spec).
   *
   * Examples: Original-Audio vs Director-Comments or English-Subtitles vs Forced-CC etc.
   */
  label: string;

  /**
   * If the media segments come in a packetized format, indicate the ID within
   * the package stream that specifies the payload stream described here.
   */
  packageStreamId: number;

  /**
   * Uri/ByteRange of segment index i.e where to enrich our segment list
   */
  segmentIndexUri: string;
  segmentIndexRange: ByteRange;
  segmentIndexProvider: () => Promise<MediaSegment[]> = null;

  /**
   * If this is an alternate rendition media for example in HLS the group-ID,
   * it is what may be used to group various media together into a set
   * which is supposed to be rendered into coherent content
   * (eg various audio/text stream options timed against a video stream).
   */
  externalReferenceId: string;

  /**
   * Like sequence-no in HLS, or DASH template index
   */
  externalIndex: number;

  /**
   * tamper-safe copy of internal data
   */
  get segments(): MediaSegment[] {
    return this._segments.slice(0);
  }

  get lastRefreshedAt(): number {
    return this._lastRefreshAt;
  }

  addSegment(mediaSegment: MediaSegment, reorderAndDedupe: boolean = true) {
    if (reorderAndDedupe) {
      this._updateSegments([mediaSegment]);
    } else {
      this._segments.push(mediaSegment);
    }
  }

  getUrl(): string {
    return this.segmentIndexUri || null;
  }

  getEarliestTimestamp(): MediaClockTime {
    if (!this._segments.length) {
      return NaN;
    }
    return this._segments[0].startTime;
  }

  getMeanSegmentDuration(): number {
    return this._segments.reduce((accu, segment) => {
      return accu + segment.duration;
    }, 0) / this._segments.length;
  }

  /**
   * @returns duration as sum of all segment durations. will be equal to window duration
   * if the media is gapless and has no time-plane discontinuities.
   */
  getCumulatedDuration(): MediaClockTime {
    return this.getSeekableTimeRanges().getCumulatedDuration();
  }

  /**
   * @returns duration as difference between last segment endTime and first segment startTime
   */
  getWindowDuration(): MediaClockTime {
    return this.getSeekableTimeRanges().getWindowDuration();
  }

  /**
   * Refresh/enrich media segments (e.g for external segment indices and for live)
   */
  refresh(autoReschedule: boolean = false,
    onSegmentsUpdate: () => void = null): Promise<AdaptiveMedia> {
    if (!this.segmentIndexProvider) {
      return Promise.reject("No segment index provider set");
    }
    this._lastRefreshAt = Date.now();

    const doAutoReschedule = () => {
      this.scheduleUpdate(this.getMeanSegmentDuration(), () => {
        if (onSegmentsUpdate) {
          onSegmentsUpdate();
        }
        doAutoReschedule();
      })
    }

    log('going to refresh media index:', this.getUrl());

    return this.segmentIndexProvider()
      .then((newSegments) => {

        // update segment-list models
        this._updateSegments(newSegments);

        if (onSegmentsUpdate) {
          onSegmentsUpdate();
        }

        // we only call this once we have new segments so
        // we can actually calculate average segment duration.
        // when autoReschedule is true, this would be called once on the initial call to refresh
        // while scheduleUpdate doesn't set to true the autoReschedule flag
        // when it calls refresh.
        // rescheduling happens as we call reschedule() via the reentrant closure in the callback here.
        if (autoReschedule) {
          doAutoReschedule();
        }

        return this;
      });
  }

  scheduleUpdate(timeSeconds: number, onRefresh: () => void = null) {
    if (!Number.isFinite(timeSeconds)) {
      warn('attempt to schedule media update with invalid time-value:', timeSeconds)
      return;
    }
    log('scheduling update of adaptive media index in:', timeSeconds);
    window.clearTimeout(this._updateTimer);
    this._updateTimer = window.setTimeout(() => {
      this.refresh().then((result: AdaptiveMedia) => {
        if (onRefresh) {
          onRefresh();
        }
      })
    }, timeSeconds * 1000);
  }

  /**
   * Activates/enables this media with the attached engine
   */
  activate(): Promise<boolean> {
    if (this.mediaEngine) {
      return this.mediaEngine.activateMediaStream(this)
    }
    return Promise.reject(false);
  }

  getSeekableTimeRanges(): TimeIntervalContainer {
    if (this._lastRefreshAt > this._lastTimeRangesCreatedAt) {
      this._updateTimeRanges();
    }
    return this._timeRanges;
  }

  /**
   *
   * @param range
   * @param partial
   * @returns segments array which are fully contained inside `range` (or only overlap when `partial` is true)
   */
  findSegmentsForTimeRange(range: TimeInterval, partial: boolean = false): MediaSegment[] {
    if (!partial) {
      return this._segments.filter((segment) => range.contains(segment.getTimeInterval()));
    } else {
      return this._segments.filter((segment) => range.overlapsWith(segment.getTimeInterval()));
    }
  }

  private _updateTimeRanges() {
    this._timeRanges = new TimeIntervalContainer();
    this._segments.forEach((segment) => {
      this._timeRanges.add(new TimeInterval(segment.startTime, segment.endTime));
    });
    this._lastTimeRangesCreatedAt = Date.now();
  }

  private _updateSegments(newSegments: MediaSegment[]) {

    log('starting update of media segment - got new segments list of size:', newSegments.length)

    // pre-deduplicate new segments by ordinal-index
    // this is to make sure we are not throwing out any already existing
    // resources here which may have ongoing request state for example.
    newSegments = newSegments.filter((segment) => {
      return this._segments.findIndex((s) => {
        if (!Number.isFinite(segment.getOrdinalIndex())) {
          return false;
        }
        return s.getOrdinalIndex() === segment.getOrdinalIndex();
      }) < 0;  // true when we didn't find any segment with that ordinal index yet
              // which means we should let it pass the filter function to be added
    });

    if (newSegments.length === 0) {
      log('no new segments found');
      return;
    }

    Array.prototype.push.apply(this._segments, newSegments);

    log('new deduplicated list size is:', this._segments.length)

    if (this._segments.length === 0) {
      return;
    }

    let startedAt: number = Date.now()

    let lastOrdinalIdx: number = -1;
    let lastSegmentEndTime: number = -1;

    log('first/last ordinal index is:',
      newSegments[0].getOrdinalIndex(),
      newSegments[newSegments.length -1].getOrdinalIndex())

    const segments: MediaSegment[] = [];

    // sort by ordinal index
    this._segments.sort((a, b) => {
      const diff = a.getOrdinalIndex() - b.getOrdinalIndex();
      if (Number.isFinite(diff)) {
        return diff;
      }
      return 0;
    }).forEach((segment) => { // extract segments in ordinal index order and deduplicate them

      const index = segment.getOrdinalIndex();

      // remove redundant indices
      // if it's NaN we don't care about this (it means there are no indices)
      if (Number.isFinite(index)
        && index === lastOrdinalIdx) { // deduplicate
        return;
      }

      // TODO: handle discontinuity-markers in segments

      // apply offset to model continuous timeline
      if (segment.startTime < lastSegmentEndTime) {
        const offset = lastSegmentEndTime - segment.startTime;
        //debug('applying offset to segment to achieve timeplane continuity:', index, offset);
        segment.setTimeOffset(offset);
      }

      if (lastOrdinalIdx !== -1 // initial case
        && index !== lastOrdinalIdx + 1) {
        warn("ordinal indices should grow monitonically but diff is:", index - lastOrdinalIdx);
      }

      lastOrdinalIdx = index;
      lastSegmentEndTime = segment.endTime;

      segments.push(segment);
    })

    this._segments = segments;

    log('updated and reorder/deduped media segment list, new length is:', segments.length)

    log('first/last ordinal index is:',
      segments[0].getOrdinalIndex(), segments[segments.length -1].getOrdinalIndex())

    log('new cummulated/window duration is:', this.getCumulatedDuration(), '/', this.getWindowDuration())

    log('updating segments done, processing took millis:', Date.now() - startedAt);
  }

}

/**
 * A set of segmented adaptive media stream representations with a given combination of content-types (see flags).
 *
 * This might be a valid playable combination of tracks (of which some might be optional).
 */
export class AdaptiveMediaSet extends Set<AdaptiveMedia> implements MediaContainer {
  parent: AdaptiveMediaPeriod
  mediaContainerInfo: MediaContainerInfo = new MediaContainerInfo()

  /**
   * @returns The default media if advertised,
   * or falls back on first media representation of the first set
   */
  getDefaultMedia(): AdaptiveMedia {
    return Array.from(this.values())[0];
  }
}

/**
 * A queriable collection of adaptive media sets. For example, each set might be an adaptation state.
 */
export class AdaptiveMediaPeriod {

  sets: AdaptiveMediaSet[] = [];

  /**
   * @returns The default adaptive-media-set if advertised,
   * or falls back on first media representation of the first set
   */
  getDefaultSet(): AdaptiveMediaSet {
    if (this.sets[0].size === 0) {
      throw new Error('No default media set found');
    }
    return this.sets[0];
  }

  getMediaListFromSet(index: number): AdaptiveMedia[] {
    return Array.from(this.sets[index]);
  }

  addSet(set: AdaptiveMediaSet) {
    if (set.parent) {
      throw new Error('Set already has a parent period');
    }
    set.parent = this;
    this.sets.push(set);
  }

  filterByContainedMediaTypes(mediaTypeFlags: MediaTypeSet, identical = false): AdaptiveMediaSet[] {
    return this.sets.filter((mediaSet) =>
      mediaSet.mediaContainerInfo.intersectsMediaTypeSet(mediaTypeFlags, identical)
    )
  }
}
