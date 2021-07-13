import { LambdaNoArgFunc, Nullable } from '../common-types';
import { noop } from '../common-utils';

type ReadableStreamQueueReaderResult<T> = Promise<ReadableStreamDefaultReadResult<T>>;

export class ReadableStreamQueueReader<T> implements ReadableStreamDefaultReader<T> {
  private _pendingRead: Nullable<ReadableStreamQueueReaderResult<T>> = null;
  private _pendingClose: Nullable<Promise<undefined>> = null;
  private _onPacketPushed: LambdaNoArgFunc = noop;
  private _onClose: LambdaNoArgFunc = noop;
  private _closed: boolean = false;
  private _err: Nullable<Error> = null;

  constructor (private _queue: T[] = []) {}

  read (): ReadableStreamQueueReaderResult<T> {
    if (this.isClosed()) {
      return Promise.resolve({
        done: true
      });
    }
    return this._pendingRead || (this._pendingRead = new Promise((resolve, reject) => {
      (this._onPacketPushed = () => {
        try {
          if (this._queue.length === 0) return;
          const value = this._queue.shift();
          this._pendingRead = null;
          this._onPacketPushed = noop;
          resolve({
            value,
            done: false
          });
        } catch (err) {
          this._err = err;
          this._pendingRead = null;
          this._onPacketPushed = noop;
          reject(err);
        }
      })();
    }));
  }

  releaseLock (): void {
    this._close();
  }

  get closed (): Promise<undefined> {
    return this._pendingClose || (this._pendingClose = new Promise((resolve, reject) => {
      (this._onClose = () => {
        if (this.isClosed()) {
          if (this._err) {
            reject(this._err);
          } else {
            resolve(void 0);
          }
        }
      })();
    }));
  }

  cancel (reason?: any): Promise<void> {
    this._close();
    return Promise.resolve();
  }

  isClosed (): boolean {
    return this._closed;
  }

  enqueue (value: T) {
    this._queue.push(value);
    if (this.isClosed()) throw new Error('Can not enqueue: Readable-stream side is closed');
    if (this._onPacketPushed) this._onPacketPushed();
  }

  private _close () {
    this._queue.length = 0;
    this._closed = true;
    this._pendingRead = null;
    this._onPacketPushed = noop;
    this._onClose();
  }
}
