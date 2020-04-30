import {ByteRange} from './byte-range'

import {
  //URLObject,
  resolveUri} from './url'

export type MediaClockTime = number

export class MediaLocator {

  static fromRelativeURI(
      relativeUri: string,
      baseUri?: string,
      byteRange?: ByteRange,
      startTime?: MediaClockTime,
      endTime?: MediaClockTime): MediaLocator {

    return new MediaLocator(
      resolveUri(relativeUri, baseUri),
      byteRange,
      startTime,
      endTime
    )
  }

  constructor(
    readonly uri: string,
    readonly byteRange: ByteRange = null,
    readonly startTime: MediaClockTime,
    readonly endTime: MediaClockTime,
  ) {
    if (startTime > endTime) {
      throw new Error('Media-locator can not be created with startTime > endTime');
    }
    // FIXME: check that we have an absolute and valid URL here
  }

  /*
  toURLObject(): URLObject {
    return new URLObject(this.uri)
  }
  */
}
