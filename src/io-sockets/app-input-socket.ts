import { InputSocket, SocketDescriptor } from '../core/socket';
import { Packet } from '../core/packet';

export type AppInputCallback = (data: Blob | ArrayBuffer) => void;

export class AppInputSocket extends InputSocket {
  constructor (
    private _appCallback: AppInputCallback,
    private _copyMode: boolean = false,
    private _blobMode: boolean = false,
    private _mimeType: string = null) {
    super((p: Packet) => this._onPacketReceived(p), new SocketDescriptor());

    if (_blobMode && !_mimeType) {
      throw new Error('Can not use blob mode with unset mimetype string');
    }
  }

  private _onPacketReceived (p: Packet): boolean {
    p.forEachBufferSlice((bs) => {
      const buffer = this._copyMode ? bs.newArrayBuffer() : bs.arrayBuffer;

      if (this._blobMode) {
        const blob = new Blob([buffer], { type: this._mimeType });
        this._appCallback(blob);
      } else {
        this._appCallback(buffer);
      }
    });

    return true;
  }
}
