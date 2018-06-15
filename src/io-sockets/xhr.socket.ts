import {SeekableOutputSocket, OutputSocket, SocketDescriptor} from '../core/socket'

import { XHR, XHRCallbackFunction, XHRState, XHRMethod, XHRResponseType } from './xhr/xhr';
import { Packet } from '../core/packet';

export class XhrSocket extends SeekableOutputSocket {
  private _xhr: XHR = null;

  constructor(url: string) {
    super(new SocketDescriptor());

    this._xhr = new XHR(url, this._xhrCallback.bind(this), XHRMethod.GET, XHRResponseType.ARRAY_BUFFER);
  }

  seek(start: number, end?: number): boolean {
    throw new Error("Method not implemented.");
  }

  private _xhrCallback(xhr: XHR, isProgressUpdate: boolean) {
    if (isProgressUpdate) {
      return; // TODO
    }

    if (xhr.xhrState === XHRState.DONE) {
      this.transfer(Packet.fromArrayBuffer(<ArrayBuffer> xhr.responseData))
    }
  }

}
