import { TimeIntervalContainer, TimeInterval } from "./time-intervals";
import { AdaptiveMedia } from "./adaptive-media";
import { MediaSegment } from "./media-segment";
import { getLogger } from "../../logger";

const { log, error } = getLogger("adaptive-stream-consumer");

export class AdaptiveMediaStreamConsumer {

  private _fetchTargetRanges: TimeIntervalContainer = new TimeIntervalContainer();
  private _bufferedRanges: TimeIntervalContainer = new TimeIntervalContainer();

  constructor(
    private _adaptiveMedia: AdaptiveMedia,
    private _onSegmentBufferedCb: (segment: MediaSegment) => void) {
  }

  getMedia(): AdaptiveMedia {
    return this._adaptiveMedia;
  }

  getBufferedRanges(): TimeIntervalContainer {
    return this._bufferedRanges;
  }

  getFetchTargetRanges(): TimeIntervalContainer {
    return this._fetchTargetRanges;
  }

  setFetchTarget(time: number) {
    this.setFetchTargetRange(new TimeInterval(0, time));
  }

  /**
   *
   * @param floor when passed negative number, floor is calculated from end of media (useful for live/DVR window)
   * @param ceiling
   */
  setFetchFloorCeiling(floor: number = 0, ceiling: number = Infinity) {

    if (floor === 0) {
      floor = this._adaptiveMedia.getEarliestTimestamp();
    } else if (floor < 0) {
      floor = Math.max(this._adaptiveMedia.getWindowDuration() - Math.abs(floor), 0);
    }

    if (ceiling === Infinity) {
      ceiling = this._adaptiveMedia.getWindowDuration(); // when to use cummulated duration?
    }

    this.setFetchTargetRange(new TimeInterval(floor, ceiling));
  }

  /**
   *
   * @param range pass `null` to just reset to clear range container
   */
  setFetchTargetRange(range: TimeInterval) {
    this._fetchTargetRanges.clear();
    if (range) {
      this.addFetchTargetRange(range);
    }
  }

  addFetchTargetRange(range: TimeInterval) {
    this._fetchTargetRanges.add(range);
    this._fetchTargetRanges = this._fetchTargetRanges.flatten();
    this._onFetchTargetRangeChanged();
  }

  private _onFetchTargetRangeChanged() {
    const mediaSeekableRange: TimeIntervalContainer = this._adaptiveMedia.getSeekableTimeRanges();
    const fetchTargetRanges = this.getFetchTargetRanges();

    log('fetch-target ranges window duration:', fetchTargetRanges.getWindowDuration())

    if (!mediaSeekableRange.hasOverlappingRangesWith(fetchTargetRanges)) {
      error('fetch target range does not overlap with media seekable range');
      return;
    }

    this._fetchAllSegmentsInTargetRange();
  }

  private _fetchAllSegmentsInTargetRange() {

    log('trying to retrieve data for fetch-range');

    const fetchTargetRanges = this.getFetchTargetRanges();
    fetchTargetRanges.ranges.forEach((range) => {
      const mediaSegments: MediaSegment[] = this._adaptiveMedia.findSegmentsForTimeRange(range, true);

      mediaSegments.forEach((segment) => {
        if (segment.isFetching || segment.hasData) {
          return;
        }

        /*
        if (!segment.hasCustomRequestMaker()) {
          throw new Error('Assertion failed: media segment should have custom request-maker');
        }
        */

        log('going to request segment resource:', segment.getOrdinalIndex(), segment.getUrl())

        segment.fetch().then(() => {

          const segmentInterval = segment.getTimeInterval();

          log('adding time-interval to buffered range:', segmentInterval.toString())

          this._bufferedRanges.add(segmentInterval).flatten(true);

          if (this._onSegmentBufferedCb) {
            this._onSegmentBufferedCb(segment);
          }
        })
      });
    });
  }

}
