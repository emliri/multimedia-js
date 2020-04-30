import {MediaSegment} from './media-segment'

import {Resource} from './resource'

import {Queue} from './queue'

/**
 * @fires fetch-all:done
 * @fires fetch-next:done
 * @fires fetch-next:error
 */
export class MediaSegmentQueue extends Queue<MediaSegment> {

  private _nextFetchPromise: Promise<Resource>

  constructor() {
    super()
  }

  get nextFetchPromise() {
    return this._nextFetchPromise
  }

  fetchAll(): void {
    this.fetchNext()
      .then(this.fetchAll.bind(this))
      .catch(() => {
        this.emit('fetch-all:done', this)
      })
  }

  /**
   * Traverse queue and fetches first segment that has no data yet
   *
   */
  fetchNext(): Promise<Resource> {
    for(let i = 0; i < this.size; i++) {
      const segment = this.get(i)
      if (!segment.hasBuffer) {
        const promise = segment.fetch()
        promise.then(() => {
          this.emit('fetch-next:done', segment)
          return segment
        }).catch((err) => {
          this.emit('fetch-next:error', err)
          return segment
        })
        this._nextFetchPromise = promise
        return promise
      }
    }
    // when there's nothing left to fetch we return a rejected promise
    // with null
    return Promise.reject(null)
  }
}
