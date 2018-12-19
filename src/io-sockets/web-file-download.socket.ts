import { InputSocket, SocketDescriptor } from "../core/socket";

import { Packet } from "../core/packet";
import { concatArrayBuffers, makeTemplate } from "../common-utils";
import { UNKNOWN_MIMETYPE } from "../core/payload-description";
import { getLogger } from "../logger";

import * as FileSaver from 'file-saver';

export const DEFAULT_FILENAME_TEMPLATE = makeTemplate("buffer${counter}-${Date.now()}.data");
export const DEFAULT_HTML_TEMPLATE = makeTemplate("<p>Download ${filename}</p>");

const {debug} = getLogger('FileDownloadSocket');

export class WebFileDownloadSocket extends InputSocket {

  private _accuBuffer: ArrayBuffer = null;
  private _bufferDownloadCnt = 0;

  /**
   *
   * @param _downloadLinkContainer an HTML element to create a link in with the given templates or `null` and then FileSaver will spawn a dialog @see https://github.com/eligrey/FileSaver.js
   * @param _fileNameTemplate can contain the local var `counter` as well as access public and private members via `this`, see default
   * @param _htmlTemplate can contain the local var `filename` which will be whatever the respective template string has eval'd to, see default
   * @param _mimeType
   */
  constructor (private _downloadLinkContainer: HTMLElement | null,
    private _mimeType: string = UNKNOWN_MIMETYPE, // FIXME: this can be a default when packet has no mime-type but we should read the mime-type from the defaultPayload info of the packet
    private _fileNameTemplate: string = DEFAULT_FILENAME_TEMPLATE,
    private _htmlTemplate = DEFAULT_HTML_TEMPLATE) {

    super((p: Packet) => this._onPacketReceived(p), new SocketDescriptor());

  }

  private _onPacketReceived(p: Packet): boolean {

    debug('received:', p.toString(), 'total bytes:', p.getTotalBytes());

    p.forEachBufferSlice((bs) => {

      debug('accumulating slice data', bs.size());

      this._accuBuffer = concatArrayBuffers(this._accuBuffer, bs.newArrayBuffer());

      const blob = new Blob([this._accuBuffer], { type: this._mimeType });
      const objectUrl = URL.createObjectURL(blob);

      // local template eval vars
      const counter = this._bufferDownloadCnt++;
      const filename = eval(this._fileNameTemplate);

      if (!this._downloadLinkContainer) {

        FileSaver.saveAs(blob, filename);

      } else {

        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.innerHTML = eval(this._htmlTemplate);
        this._downloadLinkContainer.appendChild(link);
      }
    });

    return true;

  }

}
