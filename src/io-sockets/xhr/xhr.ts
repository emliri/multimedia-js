/**
 * @author Stephan Hesse <disparat@gmail.com>
 * @module xhr An improvement over the standard XMLHttpRequest API (and with type-safety :)
 *
 * For usage in a Node.js base env (like ts-node) @see https://www.npmjs.com/package/node-http-xhr
 *
 */

// TODO: ponyfill this ^ (and dedupe this)

import { ByteRange } from './byte-range';

import { getLogger, LoggerLevel } from '../../logger';

const {
  log
} = getLogger('xhr', LoggerLevel.DEBUG);

const PROGRESS_UPDATES_ENABLED = true;

const createXHRHeadersMapFromString = function (rawHeaders: string): object {
  const arr = rawHeaders.trim().split(/[\r\n]+/);
  // create an object without a prototype (a plain vanilla "dictionary")
  const map = Object.create(null);
  arr.forEach(function (line) {
    const parts = line.split(': ');
    const header = parts.shift();
    const value = parts.join(': ');
    map[header] = value;
  });
  return map;
};

export type XHRHeader = [string, string];

export type XHRHeaders = XHRHeader[];

export type XHRData = ArrayBuffer | Blob | Document | string | FormData | null;

export enum XHRMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD'
}

export enum XHRResponseType {
  VOID = '',  //	DOMString (this is the default value)
  ARRAY_BUFFER = 'arraybuffer', // ArrayBuffer
  BLOB = 'blob', // Blob
  DOCUMENT = 'document', // Document
  JSON = 'json', //	JSON
  TEXT = 'text' // DOMString
}

export enum XHRState {
  UNSENT = XMLHttpRequest.UNSENT,
  OPENED = XMLHttpRequest.OPENED,
  HEADERS_RECEIVED = XMLHttpRequest.HEADERS_RECEIVED,
  LOADING = XMLHttpRequest.LOADING,
  DONE = XMLHttpRequest.DONE
}

export enum XHRStatusCategory {
  VOID = 'void',
  INFO = 'info',
  SUCCESS = 'success',
  REDIRECT = 'redirect',
  REQUEST_ERROR = 'request_error',
  SERVER_ERROR = 'server_error',
  CUSTOME_SERVER_ERROR = 'custom_server_error'
}

export type XHRCallbackFunction = (xhr: XHR, isProgressUpdate: boolean) => void;

/**
 *
 * Thin wrapper to keep state of one XHR.
 *
 * This class allows to perform requests, deal with their outcome and intermediate states.
 *
 * Requests are being sent out directly on construction (there is no state in between creating and sending a request).
 *
 * Any state change is signaled via the one callback function passed on construction.
 *
 * Request `xhrState` and HTTP `status` can be read via the respective instance properties.
 *
 * Check the values from within your callback.
 *
 * Same goes for response headers and body data, or eventual errors or abortion flags.
 *
 * The object is not recycleable (lives only for one single request, does not care about retrying and such).
 *
 * @class
 * @constructor
 */
export class XHR {
  private _xhrCallback: XHRCallbackFunction
  private _xhr: XMLHttpRequest
  private _responseHeadersMap: object = null
  private _error: Error = null
  private _state: XHRState = XHRState.UNSENT
  private _aborted: boolean = false
  private _loadedBytes: number = 0
  private _totalBytes: number = 0
  private _progressUpdatesEnabled: boolean = PROGRESS_UPDATES_ENABLED

  private _createdAt: Date;
  private _timeUntilHeaders: number = NaN;
  private _timeUntilLoading: number = NaN;
  private _timeUntilDone: number = NaN;

  /**
   * Enables "Content-Range" request header from given `ByteRange` object in constructor
   */
  public enableContentRange: boolean = false;

  constructor (
    url: string,
    xhrCallback: XHRCallbackFunction = () => {},
    method: XHRMethod = XHRMethod.GET,
    responseType: XHRResponseType = XHRResponseType.VOID,
    byteRange: ByteRange = null,
    headers: XHRHeaders = null,
    data: XHRData = null,
    withCredentials: boolean = false,
    timeout: number = 0,
    forceXMLMimeType: boolean = false
  ) {
    this._createdAt = new Date();
    this._xhrCallback = xhrCallback;

    const xhr = this._xhr = new XMLHttpRequest();

    xhr.open(method, url, true);
    xhr.responseType = responseType;
    xhr.onreadystatechange = this.onReadyStateChange.bind(this);
    xhr.onerror = this.onError.bind(this);
    xhr.onabort = this.onAbort.bind(this);
    xhr.onprogress = this.onProgress.bind(this);

    if (byteRange) {
      // log('set byte-range:', byteRange.toHttpHeaderValue(), byteRange.toString())
      if (this.enableContentRange) {
        xhr.setRequestHeader('Content-Range', byteRange.toHttpHeaderValue(true));
      }
      xhr.setRequestHeader('Range', byteRange.toHttpHeaderValue(false));
    }

    if (headers) {
      headers.forEach(([header, value]) => {
        xhr.setRequestHeader(header, value);
      });
    }

    if (data === null) {
      data = undefined;
    }

    xhr.timeout = timeout;

    xhr.withCredentials = withCredentials;

    if (forceXMLMimeType) {
      xhr.overrideMimeType('text/xml');
    }

    xhr.send(data);
  }

  setProgressUpdatesEnabled (enabled: boolean) {
    this._progressUpdatesEnabled = enabled;
  }

  get isInfo (): boolean {
    return this._xhr.status >= 100 && this._xhr.status <= 199;
  }

  /**
  {boolean} Returns `true` when request status code is in range [200-299] (success)
   */
  get isSuccess (): boolean {
    return this._xhr.status >= 200 && this._xhr.status <= 299;
  }

  /**
  {boolean} Returns `true` when request status code is signaling redirection
   */
  get isRedirect (): boolean {
    return this._xhr.status >= 300 && this._xhr.status <= 399;
  }

  get isRequestError (): boolean {
    return this._xhr.status >= 400 && this._xhr.status <= 499;
  }

  get isServerError (): boolean {
    return this._xhr.status >= 500 && this._xhr.status <= 599;
  }

  get isCustomServerError (): boolean {
    return this._xhr.status >= 900 && this._xhr.status <= 999;
  }

  get isContentRange (): boolean {
    return this._xhr.status === 206;
  }

  get isVoidStatus (): boolean {
    return this._xhr.status === 0;
  }

  getStatusCategory (): XHRStatusCategory {
    if (this.isInfo) {
      return XHRStatusCategory.INFO;
    }
    if (this.isSuccess) {
      return XHRStatusCategory.SUCCESS;
    }
    if (this.isRedirect) {
      return XHRStatusCategory.REDIRECT;
    }
    if (this.isRequestError) {
      return XHRStatusCategory.REQUEST_ERROR;
    }
    if (this.isServerError) {
      return XHRStatusCategory.SERVER_ERROR;
    }
    if (this.isCustomServerError) {
      return XHRStatusCategory.SERVER_ERROR;
    }
    return XHRStatusCategory.VOID;
  }

  get error (): Error {
    return this._error;
  }

  /**
   * Native Upload object
   * @readonly
   */
  get upload (): XMLHttpRequestUpload {
    return this._xhr.upload;
  }

  /**
   * Native XHR object
   * @readonly
   */
  get xhr (): XMLHttpRequest {
    return this._xhr;
  }

  get xhrState (): XHRState {
    return this._state;
  }

  get status (): number {
    return this._xhr.status;
  }

  get statusText (): string {
    return this._xhr.statusText;
  }

  get responseHeaders (): object {
    return this._responseHeadersMap;
  }

  get responseData (): XHRData {
    return this._xhr.response;
  }

  get responseText (): string {
    return this._xhr.responseText;
  }

  get responseDocument (): Document {
    return this._xhr.responseXML;
  }

  get responseURL (): string {
    return this._xhr.responseURL;
  }

  get hasBeenAborted (): boolean {
    return this._aborted;
  }

  get hasErrored (): boolean {
    return !!this._error;
  }

  get loadedBytes () {
    return this._loadedBytes;
  }

  get totalBytes () {
    return this._totalBytes;
  }

  get secondsUntilHeaders () {
    return this._timeUntilHeaders;
  }

  get secondsUntilLoading () {
    return this._timeUntilLoading;
  }

  get secondsUntilDone () {
    return this._timeUntilDone;
  }

  /**
  {number}
   */
  get loadedFraction () {
    return this._loadedBytes / this._totalBytes;
  }

  abort () {
    this._xhr.abort();
  }

  onReadyStateChange () {
    const xhr = this._xhr;

    this._state = xhr.readyState;

    switch (xhr.readyState) {
    case XMLHttpRequest.UNSENT:
      break;
    case XMLHttpRequest.OPENED:
      break;
    case XMLHttpRequest.HEADERS_RECEIVED:
      this._timeUntilHeaders = this.getSecondsSinceCreated();

      const headers = xhr.getAllResponseHeaders();
      this._responseHeadersMap = createXHRHeadersMapFromString(headers);
      break;
    case XMLHttpRequest.LOADING:
      this._timeUntilLoading = this.getSecondsSinceCreated();
      break;
    case XMLHttpRequest.DONE:
      this._timeUntilDone = this.getSecondsSinceCreated();
      break;
    }

    this._xhrCallback(this, false);
  }

  onError (event: ErrorEvent) {
    this._error = event.error;

    this._xhrCallback(this, false);
  }

  onAbort (event: Event) {
    this._aborted = true;

    this._xhrCallback(this, false);
  }

  onProgress (event: ProgressEvent) {
    this._loadedBytes = event.loaded;
    this._totalBytes = event.total;

    if (this._progressUpdatesEnabled) {
      this._xhrCallback(this, true);
    }
  }

  getSecondsSinceCreated () {
    return (new Date().getTime() - this._createdAt.getTime()) / 1000;
  }
}
