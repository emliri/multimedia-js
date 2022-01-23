import { InputSocket, SocketDescriptor } from '../core/socket';
import { Packet, PacketSymbol } from '../core/packet';

export type AppInputCallback = (data: Blob | ArrayBuffer | Uint8Array,
  mimeType: string | null, timestamp: number, socket: InputSocket) => void;

export class AppInputSocket extends InputSocket {
  constructor (
    private _appCallback: AppInputCallback,
    private _copyMode: boolean = false,
    private _blobMode: boolean = false,
    private _mimeType: string = null) {
    super((p: Packet) => this._onPacketReceived(p), new SocketDescriptor());
  }

  private _onPacketReceived (p: Packet): boolean {
    p.forEachBufferSlice((bs) => {
      const buffer = this._copyMode ? bs.newArrayBuffer() : bs.arrayBuffer;
      const mimeType = this._mimeType || p?.properties.mimeType || null;

      if (this._blobMode) {
        if (!mimeType) {
          throw new Error('No mime-type could be determined to build output in blob mode');
        }

        const blob = new Blob([buffer], { type: mimeType });
        this._appCallback(blob, null, p.timestamp, this);
      } else {
        this._appCallback(buffer, mimeType, p.timestamp, this);
      }
    });

    return true;
  }
}
