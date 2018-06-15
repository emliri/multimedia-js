import { XhrSocket } from "../io-sockets/xhr.socket";
import { MP4DemuxProcessor } from "../processors/mp4-demux.processor";
import { MP4MuxProcessor, MP4MuxProcessorSupportedCodecs } from "../processors/mp4-mux.processor";
import { Tubing, TubingState, TubingStateChangeCallback } from "../core/tubing";
import { Socket, OutputSocket } from '../core/socket';

export class HttpToMediaSourceTubing extends Tubing {

  private _xhrSocket: XhrSocket;

  constructor(url: string) {

    super(
      (prevState, newState) => {
        console.log('previous state:', prevState, 'new state:', newState)
      },
      (reason) => {
        console.log('state change aborted. reason:', reason);
      }
    );

    const xhrSocket = this._xhrSocket = new XhrSocket(url);

    const mp4MuxProc = new MP4MuxProcessor();

    const onMp4DemuxCreateOutput = (s: OutputSocket) => {
      console.log('mp4 demux output created');

      ///*
      const socket = mp4MuxProc.addVideoTrack(
        MP4MuxProcessorSupportedCodecs.AVC,
        25, // fps
        768, 576 // res
      );
      //*/

      s.connect(mp4MuxProc.in[0])
    };

    const mp4DemuxProc = new MP4DemuxProcessor(onMp4DemuxCreateOutput);

    xhrSocket.connect(mp4DemuxProc.in[0]);

    const mediaSourceSocket = null;

    this.add(mp4DemuxProc, mp4MuxProc, mediaSourceSocket);
  }

  /**
   * @override
   */
  getExternalSockets(): Set<Socket> {
    return new Set([this._xhrSocket]);
  }

  protected onVoidToWaiting_(cb: TubingStateChangeCallback) {}

  protected onWaitingToVoid_(cb: TubingStateChangeCallback) {}

  protected onWaitingToFlowing_(cb: TubingStateChangeCallback) {}

  protected onFlowingToWaiting_(cb: TubingStateChangeCallback) {}

  protected onStateChangeAborted_(reason: string) {}
}
