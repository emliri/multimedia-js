import { Flow, FlowStateChangeCallback } from '../core/flow';
import { XhrSocket } from '../io-sockets/xhr.socket';
import { MPEGTSDemuxProcessor } from '../processors/mpeg-ts-demux.processor';
import { MP3ParseProcessor } from '../processors/mp3-parse.processor';
import { ProcessorEvent } from '../core/processor';

export class TsToMp3Flow extends Flow {
  private _xhrSocket: XhrSocket = null;

  constructor (url: string) {
    super(
      (prevState, newState) => {
        console.log('previous state:', prevState, 'new state:', newState);
      },
      (reason) => {
        console.log('state change aborted. reason:', reason);
      }
    );

    const tsDemuxProc = new MPEGTSDemuxProcessor();
    const mp3ParseProc = new MP3ParseProcessor();
    const xhrSocket = this._xhrSocket = new XhrSocket(url);

    xhrSocket.connect(tsDemuxProc.in[0]);

    tsDemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, () => {
      tsDemuxProc.out[0].connect(mp3ParseProc.in[0]);
    });
  }

  protected onVoidToWaiting_ (cb: FlowStateChangeCallback) {}

  protected onWaitingToVoid_ (cb: FlowStateChangeCallback) {}

  protected onWaitingToFlowing_ (cb: FlowStateChangeCallback) {}

  protected onFlowingToWaiting_ (cb: FlowStateChangeCallback) {}

  protected onStateChangeAborted_ (reason: string) {}
}
