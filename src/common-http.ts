import {XHR, XHRMethod, XHRResponseType, XHRState} from './io-sockets/xhr/xhr';
import {ByteRange} from './io-sockets/xhr/byte-range';

export function makeGetRequest(url: string): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const xhr = new XHR(url, (xhr, isProgressUpdate: boolean) => {
      if (xhr.xhrState !== XHRState.DONE) {
        return;
      }
      if (xhr.status === 200) {
        resolve(<ArrayBuffer> xhr.responseData);
        return;
      }
      if (xhr.status !== 200) {
        reject(xhr.error);
        return;
      }
    }, XHRMethod.GET, XHRResponseType.ARRAY_BUFFER);
  });
}
