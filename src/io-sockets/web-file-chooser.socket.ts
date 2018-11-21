import { OutputSocket, SocketDescriptor } from "../core/socket";
import { XhrSocket } from "./xhr.socket";
import { getLogger } from "../logger";

const {warn} = getLogger('WebFileChooserSocket');

export class WebFileChooserSocket extends OutputSocket {

  private _xhrSocket: XhrSocket = null;

  constructor(
    private _domRootEl: HTMLElement,
    _accepts: string = '*',
    _label: string = "") {

    super(new SocketDescriptor());

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = _accepts;
    input.multiple = false;
    input.addEventListener('change', () => {

      if (!input.files[0]) {
        warn('No file selected after change event');
        return;
      }

      if (this._xhrSocket) {
        this._xhrSocket.disconnect(this);
      }

      if (this._xhrSocket.hasPeers()) {
        throw new Error('Socket should not have any other internal peers');
      }

      this._xhrSocket = new XhrSocket(URL.createObjectURL(input.files[0]));
      this._xhrSocket.connect(this);
    });

    const label = document.createElement('label');
    label.appendChild(document.createTextNode(_label));
    label.appendChild(input);

    this._domRootEl.appendChild(label);

  }

}
