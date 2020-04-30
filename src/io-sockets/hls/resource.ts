
import {EventEmitter} from 'eventemitter3'

import {
  resolveUri,
  //URLObject
} from './url'

import {
  XHRMethod,
  XHRResponseType,
  XHRState,
} from './xhr'

import {ByteRange} from './byte-range'
import { ResourceRequestMaker, IResourceRequest, makeDefaultRequest, ResourceRequestResponseData } from './resource-request';

export enum ResourceEvents {
  BUFFER_SET = 'buffer:set',
  BUFFER_CLEAR = 'buffer:clear',
  FETCH_PROGRESS = 'fetch:progress',
  FETCH_ABORTED = 'fetch:aborted',
  FETCH_ERRORED = 'fetch:errored',
  FETCH_SUCCEEDED = 'fetch:succeeded',
  FETCH_SUCCEEDED_NOT = 'fetch:succeeded-not',
}

export interface ParseableResource<ParsingResultType> extends Resource {
  hasBeenParsed(): boolean

  parse(): Promise<ParsingResultType>
}

export interface SegmentableResource<SegmentType> extends Resource {

  getSegments(): Promise<SegmentType[]>
}

export interface DecryptableResource extends Resource {
  decrypt(): Promise<DecryptableResource>
}

export class Resource extends EventEmitter {

  private uri_: string;
  private baseUri_: string;
  private byteRange_: ByteRange;
  private ab_: ArrayBuffer;
  private abortedCnt_: number;
  private fetchAttemptCnt_: number;

  private requestMaker_: ResourceRequestMaker | null = null;
  private request_: IResourceRequest = null;

  private requestResponseData_: ResourceRequestResponseData[] = [];

  private requestBytesLoaded_: number = NaN;
  private requestBytesTotal_: number = NaN;

  private mimeType_: string // TODO: set this from response headers;

  private fetchLatency_: number = NaN;
  private fetchResolve_: (ms: Resource) => void = null
  private fetchReject_: (e: Error) => void = null

  /**
   *
   * @param uri may be relative or absolute
   * @param byteRange
   * @param baseUri
   * @param mimeType
   */
  constructor(uri: string, byteRange: ByteRange = null, baseUri: string = null, mimeType: string = null) {
    super()

    this.uri_ = uri
    this.baseUri_ = baseUri
    this.byteRange_ = byteRange
    this.mimeType_ = mimeType

    this.ab_ = null

    this.abortedCnt_ = 0
    this.fetchAttemptCnt_ = 0

    this.request_ = null
  }

  get uri(): string {
    return this.uri_
  }

  get baseUri(): string {
    return this.baseUri_
  }

  get byteRange(): ByteRange {
    return this.byteRange_
  }

  get mimeType(): string {
    return this.mimeType_
  }

  get hasBuffer(): boolean {
    return this.ab_ !== null
  }

  get hasRequestResponses(): boolean {
    return this.requestResponseData_.length > 0;
  }

  get hasData(): boolean {
    return this.hasBuffer || this.hasRequestResponses;
  }

  get buffer(): ArrayBuffer {
    return this.ab_
  }

  get timesAborted(): number {
    return this.abortedCnt_
  }

  get timesFetchAttempted(): number {
    return this.fetchAttemptCnt_
  }

  get isFetching(): boolean {
    return !! this.request_
  }

  get fetchLatency(): number {
    return this.fetchLatency_
  }

  get requestedBytesLoaded(): number {
    return this.requestBytesLoaded_ || 0
  };

  get requestedBytesTotal(): number {
    return this.requestBytesTotal_ || 0
  };

  getRecordedTransmissionRateBps(): number {
    return 8 * this.requestBytesLoaded_ / this.fetchLatency_;
  }

  setBaseUri(baseUri: string) {
    this.baseUri_ = baseUri;
  }

  /**
   * Tries to resolve the resource's URI to an absolute URL,
   * with the given `baseUri` at construction or the optional argument
   * (which overrides the base of this instance for this resolution, but does not overwrite it).
   * Create a new resource object to do that.
   */
  getUrl(base?: string): string {
    return resolveUri(this.uri, base ? base : this.baseUri_)
  }

  /*
  getURLObject(): URLObject {
    return new URLObject(this.getUrl())
  }
  */

  setBuffer(ab: ArrayBuffer): void {
    this.ab_ = ab
    this.emit(ResourceEvents.BUFFER_SET)
  }

  clearBuffer(ab): void {
    this.ab_ = null
    this.emit(ResourceEvents.BUFFER_CLEAR)
  }

  fetch(
    responseType: XHRResponseType = XHRResponseType.ARRAY_BUFFER,
    method: XHRMethod = XHRMethod.GET
    ): Promise<Resource> {
    this.fetchAttemptCnt_++

    if (this.request_) {
      throw new Error('Assertion failed: resource already has request for ongoing fetch');
    }

    const fetchPromise = new Promise<Resource>((resolve, reject) => {
      this.fetchResolve_ = resolve
      this.fetchReject_ = reject
    })

    const url = this.getUrl();
    //console.log(url);

    const makeRequest = this.getRequestMaker();

    this.requestBytesLoaded_ = NaN;
    this.requestBytesTotal_ = NaN;

    this.request_ = makeRequest(url, {
      requestCallback: this.onRequestCallback_.bind(this),
      method,
      responseType,
      byteRange: this.byteRange
    });

    return fetchPromise
  }

  abort() {
    if (!this.request_) {
      throw new Error('Assertion failed: can`t abort, resource has no ongoing request');
    }

    this.abortedCnt_++
    this.request_.abort()
  }

  /**
   *
   * @param rm passing null means use default
   */
  setRequestMaker(rm: ResourceRequestMaker | null) {
    this.requestMaker_ = rm;
  }

  getRequestMaker(): ResourceRequestMaker {
    if (this.requestMaker_) {
      return this.requestMaker_;
    }
    return makeDefaultRequest;
  }

  hasCustomRequestMaker(): boolean {
    return !!this.requestMaker_;
  }

  getRequestResponses(): ResourceRequestResponseData[] {
    return this.requestResponseData_;
  }

  flushAllRequestResponses(): void {
    this.requestResponseData_ = [];
  }

  getRequestResponse(pop: boolean = false) {
    if (pop) {
      return this.requestResponseData_.pop();
    } else {
      if (this.requestResponseData_.length === 0) {
        throw new Error('No response datas for resources');
      }
      return this.requestResponseData_[this.requestResponseData_.length - 1];
    }
  }

  setExternalyFetchedBytes(loaded: number, total: number, latency: number) {
    this.requestBytesLoaded_ = loaded;
    this.requestBytesTotal_ = total;
    this.fetchLatency_ = latency;
    this.emit(ResourceEvents.FETCH_PROGRESS);
  }

  private onRequestCallback_(request: IResourceRequest, isProgressUpdate: boolean) {

    //console.log('onRequestCallback', request.xhrState, XHRState.DONE)

    let reset: boolean = false;

    if (request !== this.request_) {
      throw new Error('Assertion failed: request-callback has invalid user-data reference');
    }

    if (request.xhrState === XHRState.DONE) {

      this.fetchLatency_ = request.secondsUntilDone;

      if (request.wasSuccessful()) {
        const response = new ResourceRequestResponseData(request, this)
        this.requestResponseData_.push(response);
        //console.log('data', request.responseData)
        this.setBuffer(response.getArrayBuffer())
        //console.log('resolve')
        this.fetchResolve_(this)
        this.emit(ResourceEvents.FETCH_SUCCEEDED)
      } else {
        // this.fetchReject_(); // reject or just let time-out in case?
        this.emit(ResourceEvents.FETCH_SUCCEEDED_NOT);
      }

      reset = true;

    } else if (request.xhrState === XHRState.LOADING) {
      this.fetchLatency_ = request.secondsUntilLoading
    } else if (request.xhrState === XHRState.HEADERS_RECEIVED) {
      this.fetchLatency_ = request.secondsUntilHeaders
    } else if (request.xhrState === XHRState.OPENED) {
      //
    }

    if (isProgressUpdate) {
      this.requestBytesLoaded_ = request.loadedBytes;
      this.requestBytesTotal_ = request.totalBytes;
      this.emit(ResourceEvents.FETCH_PROGRESS, request.loadedBytes, request.totalBytes);
    }

    if (request.hasBeenAborted) {
      this.emit(ResourceEvents.FETCH_ABORTED)

      this.fetchReject_(new Error('Fetching media segment was aborted'))
    }

    if (request.hasErrored) {
      this.emit(ResourceEvents.FETCH_ERRORED)

      this.fetchReject_(request.error)
    }

    if (reset) {
      // reset fetch promise hooks
      this.fetchReject_ = null
      this.fetchResolve_ = null
      // XHR object is done and over, let's get rid of it
      this.request_ = null
    }
  }

}
