import { InputSocket, SocketDescriptor } from "../core/socket";

import { Packet } from "../core/packet";
import { concatArrayBuffers } from "../common-utils";
import { UNKNOWN_MIMETYPE } from "../core/payload-description";
import { getLogger } from "../logger";

export const DEFAULT_FILENAME_TEMPLATE = "`buffer${counter}-${Date.now()}.data`";
export const DEFAULT_HTML_TEMPLATE = "`<p>Download ${fileName}</p>`";

const {debug} = getLogger('FileDownloadSocket');

export class FileDownloadSocket extends InputSocket {

  private _accuBuffer: ArrayBuffer = null;
  private _bufferDownloadCnt = 0;

  /**
   *
   * @param _downloadLinkContainer
   * @param _fileNameTemplate can contain the local var `counter` as well as access public and private members via `this`, see default
   * @param _htmlTemplate can contain the local var `fileName` which will be whatever the respective template string has eval'd to, see default
   * @param _mimeType
   */
  constructor (private _downloadLinkContainer: HTMLElement,
    private _mimeType: string = UNKNOWN_MIMETYPE, // FIXME: this can be a default when packet has no mime-type but we should read the mime-type from the defaultPayload info of the packet
    private _fileNameTemplate: string = DEFAULT_FILENAME_TEMPLATE,
    private _htmlTemplate = DEFAULT_HTML_TEMPLATE) {

    super((p: Packet) => this._onPacketReceived(p), new SocketDescriptor());

  }

  private _onPacketReceived(p: Packet): boolean {

    debug('received:', p.toString(), 'total bytes:', p.getTotalBytes());

    p.forEachBufferSlice((bs) => {

      this._accuBuffer = concatArrayBuffers(this._accuBuffer, bs.arrayBuffer); // FIXME: should use newArrayBuffer and avoid copying "twice"

      const blob = new Blob([this._accuBuffer], { type: this._mimeType });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      // local template eval vars
      let counter = this._bufferDownloadCnt;
      const fileName = eval(this._fileNameTemplate);

      link.href = objectUrl;
      link.download = fileName;
      link.innerHTML = eval(this._htmlTemplate);
      this._downloadLinkContainer.appendChild(link);

      this._bufferDownloadCnt = ++counter;

    });

    return true;

  }

}
