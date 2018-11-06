import { SeekableOutputSocket, OutputSocket, SocketDescriptor } from '../core/socket';

import { XHR, XHRCallbackFunction, XHRState, XHRMethod, XHRResponseType } from './xhr/xhr';
import { Packet } from '../core/packet';
import { getLogger } from '../logger';

const {log, warn, error} = getLogger("XhrSocket");

export class XhrSocket extends SeekableOutputSocket {
  private _xhr: XHR = null;

  constructor (url: string) {
    super(new SocketDescriptor());

    this._xhr = new XHR(url, this._xhrCallback.bind(this), XHRMethod.GET, XHRResponseType.ARRAY_BUFFER);
  }

  seek (start: number, end?: number): boolean {
    throw new Error('Method not implemented.');
  }

  private _xhrCallback (xhr: XHR, isProgressUpdate: boolean) {
    if (isProgressUpdate) {
      return; // TODO
    }

    if (xhr.xhrState === XHRState.DONE) {
      log('got data for url:', this._xhr.responseURL)
      this.transfer(Packet.fromArrayBuffer(<ArrayBuffer> xhr.responseData));
      log('transferring EOS symbol');
      // EOS
      this.transfer(Packet.newEos());
    }
  }
}
