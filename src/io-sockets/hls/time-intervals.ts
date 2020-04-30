/**
 * @author Stephan Hesse (c) Copyright 2018 <stephan@emliri.com>
 *
 */

/**
 * @module time-intervals Allows to deal with time-intervals/ranges and perform all sorts of operations on them
 * including merging/concat, flattening, aggregation/duration/window-sum and comparison of all sorts.
 *
 * Can also digest native TimeRanges objects.
 */

export type TimeIntervalProperties = {
  seekable: boolean
  desired: boolean
  fetched: boolean
};

export class TimeInterval {
  private _props: TimeIntervalProperties = {
    seekable: true,
    desired: false,
    fetched: false
  };

  constructor(
    public readonly start: number,
    public readonly end: number
  ) {
    if(!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error('Interval is non-finite');
    }

    if (end <= start) {
      throw new Error(`Time-range must have end (${end}) strictly larger than start (${start})`);
    }
  }

  get props(): TimeIntervalProperties {
    return this._props;
  }

  /**
   * @returns must be > 0
   */
  get duration(): number {
    return this.end - this.start;
  }

  /**
   * @override
   */
  toString(): string {
    return `<${this.start}-${this.end}>(${this.duration})`;
  }

  /**
   *
   * @param range
   * @returns positive if `range` starts after this starts
   */
  compareStart(range: TimeInterval): number {
    return range.start - this.start;
  }

  /**
   *
   * @param range
   * @returns positive if `range` ends after this ends
   */
  compareEnd(range: TimeInterval): number {
    return range.end - this.end;
  }

  /**
   *
   * @param time a value to compare this interval with
   * @param strict when true, uses strict comparison (boundaries not part of interval)
   * @returns true when time values lies within interval
   */
  compareInterval(time: number, strict: boolean = false): boolean {
    if (strict) {
      return time > this.start && time < this.end;
    } else {
      return time >= this.start && time <= this.end;
    }
  }

  /**
   *
   * @param range
   * @returns true when `range` is fully inside this
   */
  contains(range: TimeInterval): boolean {
    return this.compareStart(range) >= 0 && this.compareEnd(range) <= 0;
  }

  /**
   *
   * @param range
   * @returns true when `range` interval is equal to this
   */
  equals(range: TimeInterval): boolean {
    return this.compareStart(range) === 0 && this.compareEnd(range) === 0;
  }

  /**
   *
   * @param range
   * @returns true when ranges overlap somehow
   */
  overlapsWith(range: TimeInterval): boolean {
    const [start, end] = this._getOverlapRangeBoundaries(range);
    return start < end;
  }

  /**
   *
   * @param range
   * @returns true when `range` and this are continuous in their interval values
   */
  touchesWith(range: TimeInterval): boolean {
    return (range.end === this.start || this.end === range.start);
  }

  /**
   *
   * @param range
   * @returns true when this is continued by `range`
   * See `touchesWith` but implies order, when this comes after `range`.
   */
  continues(range: TimeInterval): boolean {
    return range.compareStart(this) === range.duration;
  }

  /**
   *
   * @param range
   * @returns a new range object that represents the overlapping range region (if any) or `null`
   */
  getOverlappingRange(range: TimeInterval): TimeInterval | null {
    const [start, end] = this._getOverlapRangeBoundaries(range);

    // if both ranges don't overlap at all
    // we will obtain end <= start here
    // this is a shorthand to do this check built in our constructor
    let overlapRange;
    try {
      overlapRange = new TimeInterval(
        start, end
      );
    } catch(err) {
      overlapRange = null;
    }

    return overlapRange;
  }

  /**
   *
   * @param range
   * @returns a new range object that represents the merge of two ranges (that must overlap)
   */
  getMergedRange(range: TimeInterval): TimeInterval | null {
    if (!range.overlapsWith(this) && !range.touchesWith(this)) {
      return null;
    }

    // If both ranges already overlap (or touch) then the merge is
    // simply the range over the min of both starts and the max of both ends
    return new TimeInterval(
      Math.min(this.start, range.start),
      Math.max(this.end, range.end)
    )
  }

  getGapRange(range: TimeInterval): TimeInterval | null {
    if (range.overlapsWith(this)) {
      return null;
    }

    // If both ranges don't overlap at all
    // simply the range over the min of both ends as start and the max of both starts as end
    return new TimeInterval(
      Math.min(this.end, range.end),
      Math.max(this.start, range.start)
    )
  }

  /**
   *
   * @param range
   * @returns candidates for start/end points of overlapping ranges (when start > end then they don't overlap)
   */
  private _getOverlapRangeBoundaries(range: TimeInterval): [number, number] {
    const startDiff = this.compareStart(range);
    const endDiff = this.compareEnd(range);
    let start: number;
    let end: number;

    // compute candidates for overlapping range boundaries
    if (startDiff > 0) {
      start = range.start;
    } else {
      start = this.start;
    }

    if (endDiff > 0) {
      end = this.end;
    } else {
      end = range.end;
    }

    return [start, end];
  }
}

export class TimeIntervalContainer {

  static fromTimeRanges(ranges: TimeRanges) {
    const timeIntervalContainer = new TimeIntervalContainer();
    timeIntervalContainer.addTimeRanges(ranges);
  }

  constructor(
    private _ranges: TimeInterval[] = [],
    private _isFlat: boolean = false
  ) {}

  get ranges(): TimeInterval[] {
    return this._ranges;
  }

  get size(): number {
    return this._ranges.length;
  }

  add(range: TimeInterval): TimeIntervalContainer {
    this._isFlat = false;
    this._ranges.push(range);
    return this;
  }

  clear(): TimeIntervalContainer  {
    this._ranges = [];
    this._isFlat = false;
    return this;
  }

  /**
   * Flattens the time-ranges so that if they overlap or touch they get merged into one.
   * This can be used to avoid when we add overlapping time-ranges that the container elements number
   * grows while keeping the same necessary information for most use-cases.
   * @returns a flattened version of the time-intervals in this container
   */
  flatten(inPlace: boolean = false): TimeIntervalContainer {
    if (this._isFlat) {
      return this;
    }

    const newRanges: TimeInterval[] = [];

    let previousRange: TimeInterval = null;

    this._ranges.forEach((range) => {
      if (!previousRange) {
        newRanges.push(range);
        previousRange = range;
        return;
      }
      const overlap = previousRange.getMergedRange(range);
      if (overlap) {
        newRanges.pop(); // pop of the previous range since it overlaps/touches with current
        newRanges.push(overlap); // push in the merge of both
        range = overlap; // the current range becomes the merged range
      } else {
        newRanges.push(range);
      }
      previousRange = range; // the previous range might also be merged one (as it may overlap/touch with future ranges)
    })

    if (inPlace) {
      this._ranges = newRanges;
      this._isFlat = true;
      return this;
    } else {
      return new TimeIntervalContainer(newRanges, true);
    }
  }

  sort(inPlace: boolean = false): TimeIntervalContainer {
    const newRanges: TimeInterval[] = this._ranges.sort((a, b) => {
      return a.start - b.start;
    })

    if (inPlace) {
      this._ranges = newRanges;
      return this;
    } else {
      return new TimeIntervalContainer(newRanges);
    }
  }

  /**
   * Cross-checks every range in this container with the ranges in other containers for overlaps.
   * Early-returns as soon as the first overlap is found.
   * @param ranges
   * @returns true if any range from this overlaps with a range from that
   */
  hasOverlappingRangesWith(ranges: TimeIntervalContainer): boolean {
    const thisFlat: TimeInterval[] = this.flatten().ranges;
    const otherFlat: TimeInterval[] = ranges.flatten().ranges;

    for (let i=0; i < thisFlat.length; i++) {
      for (let k=0; k < otherFlat.length; k++) {
        if (thisFlat[i].overlapsWith(otherFlat[k])) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks one value against all intervals in this
   * @param value
   */
  hasIntervalsWith(value: number): boolean {
    const thisFlat: TimeInterval[] = this.flatten().ranges;

    for (let i=0; i < thisFlat.length; i++) {
      if (thisFlat[i].compareInterval(value)) {
        return true;
      }
    }
    return false;
  }

  getEarliestRange(): TimeInterval {
    if (this._ranges.length === 0) {
      return null;
    }
    return this.sort().ranges[0];
  }

  /**
   * @returns duration as sum of all interval durations. will be equal to window duration
   * if the media is gapless and has no time-plane discontinuities.
   */
  getCumulatedDuration(): number {
    return this._ranges.reduce((accu: number, range: TimeInterval) => {
      return accu + range.duration
    }, 0)
  }

  /**
   * @returns duration as difference between last interval end and first interval start
   */
  getWindowDuration(): number {
    if (!this._ranges.length) {
      return 0;
    }

    const duration = this._ranges[this._ranges.length -1].end - this._ranges[0].start;
    if (duration <= 0) {
      throw new Error('Window-duration should be larger than zero');
    }

    return duration;
  }

  toTimeRanges(): TimeRanges {
    // FIXME:
    throw new Error('Not implemented')
  }

  /**
   * For compatibility with HTML5 native TimeRanges object,
   * converts them internally to TimeInterval for each element in TimeRanges container.
   * @param ranges HTML5 TimeRanges object
   */
  addTimeRanges(ranges: TimeRanges) {
    for (let i=0; i < ranges.length; i++) {
      this.add(new TimeInterval(
        ranges.start(i),
        ranges.end(i)
      ))
    }
  }
}
