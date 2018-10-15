import { Flow, FlowStateChangeCallback } from "../core/flow";
import { XhrSocket } from "../io-sockets/xhr.socket";
import { MP4DemuxProcessor } from "../processors/mp4-demux.processor";

export class MovToFmp4Flow extends Flow {

  private _xhrSocket: XhrSocket = null;

  constructor(movUrl: string) {
    super(
      (prevState, newState) => {
        console.log('previous state:', prevState, 'new state:', newState)
      },
      (reason) => {
        console.log('state change aborted. reason:', reason);
      }
    );

    const mp4DemuxProc = new MP4DemuxProcessor();
    const xhrSocket = this._xhrSocket = new XhrSocket(movUrl);

    xhrSocket.connect(mp4DemuxProc.in[0]);
  }

  protected onVoidToWaiting_(cb: FlowStateChangeCallback) {}

  protected onWaitingToVoid_(cb: FlowStateChangeCallback) {}

  protected onWaitingToFlowing_(cb: FlowStateChangeCallback) {}

  protected onFlowingToWaiting_(cb: FlowStateChangeCallback) {}

  protected onStateChangeAborted_(reason: string) {}
}
