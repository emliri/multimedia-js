import { XHRCallbackFunction, XHRMethod, XHRResponseType, XHRHeaders, XHRData, XHR, XHRState } from "./xhr";
import { ByteRange } from "./byte-range";
import { utf8StringToArray, unicodeBytesToString, utf8BytesToString } from "./bytes-read-write";
import { Resource } from "./resource";

export interface IResourceRequest {
  abort();
  wasSuccessful(): boolean;

  readonly xhrState: XHRState;

  readonly responseType: XHRResponseType;
  readonly responseData: XHRData;
  readonly responseHeaders: object;

  readonly loadedBytes: number;
  readonly totalBytes: number;

  readonly hasBeenAborted: boolean;
  readonly hasErrored: boolean;
  readonly error: Error;

  readonly secondsUntilLoading: number;
  readonly secondsUntilDone: number;
  readonly secondsUntilHeaders: number;
}

export class ResourceRequestResponseData {
  constructor(public readonly request: IResourceRequest, public readonly resource: Resource) {}

  isBinary() {
    return this.request.responseData === XHRResponseType.ARRAY_BUFFER
      || this.request.responseData === XHRResponseType.BLOB
  }

  isChars() {
    return this.request.responseType === XHRResponseType.TEXT
      || this.request.responseType === XHRResponseType.JSON;
  }

  getArrayBuffer(): ArrayBuffer {
    if (this.request.responseType === XHRResponseType.TEXT
      || this.request.responseType === XHRResponseType.JSON) {
      return utf8StringToArray(<string> this.request.responseData);
    }
    else if (this.request.responseType === XHRResponseType.ARRAY_BUFFER) {
      return <ArrayBuffer> (this.request.responseData as any);
    }
    else {
      console.error('Can not convert response data to arraybuffer for url: ' + this.resource.getUrl());
      return null;
    }
  }

  getString(unicode16: boolean = false): string {
    if (this.request.responseType === XHRResponseType.TEXT
      || this.request.responseType === XHRResponseType.JSON) {
        return <string> this.request.responseData;
    }
    else if (this.request.responseType === XHRResponseType.ARRAY_BUFFER) {
      if (unicode16) {
        return unicodeBytesToString(new Uint16Array(<ArrayBuffer> (this.request.responseData as any)));
      } else {
        return utf8BytesToString(new Uint8Array(<ArrayBuffer> (this.request.responseData as any)));
      }
    }
    else {
      console.error('Can not convert response data to string');
      return null;
    }
  }

  // TODO: add getBlob/Document/Form ...
}

export type ResourceRequestCallback = (req: IResourceRequest, isProgressUpdate: boolean) => void;

export type ResourceRequestOptions = Partial<{
  requestCallback: ResourceRequestCallback,
  method: XHRMethod,
  responseType: XHRResponseType,
  byteRange: ByteRange,
  headers: XHRHeaders,
  data: XHRData,
  withCredentials: boolean,
  timeout: number,
  forceXMLMimeType: boolean
}>

export type ResourceRequestMaker = (url: string, opts: ResourceRequestOptions) => IResourceRequest;

export const makeDefaultRequest: ResourceRequestMaker
  = (url, opts) => new XHR(url,
    opts.requestCallback,
    opts.method,
    opts.responseType,
    opts.byteRange,
    opts.headers,
    opts.data,
    opts.withCredentials,
    opts.timeout,
    opts.forceXMLMimeType
  );

