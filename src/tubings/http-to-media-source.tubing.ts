import { XhrSocket } from "../io-sockets/xhr.socket";
import { MP4DemuxProcessor } from "../processors/mp4-demux.processor";
import { MPEGTSDemuxProcessor } from "../processors/mpeg-ts-demux.processor";
import { MP4MuxProcessor, MP4MuxProcessorSupportedCodecs } from "../processors/mp4-mux.processor";
import { Tubing, TubingState, TubingStateChangeCallback } from "../core/tubing";
import { Socket, OutputSocket } from '../core/socket';
import { H264ParseProcessor } from "../processors/h264-parse.processor";
import { HTML5MediaSourceBufferSocket } from "../io-sockets/html5-media-source-buffer.socket";
import { ProcessorEvent, ProcessorEventData } from "../core/processor";

export class HttpToMediaSourceTubing extends Tubing {

  private _xhrSocket: XhrSocket;

  constructor(url: string, mediaSource: MediaSource) {

    super(
      (prevState, newState) => {
        console.log('previous state:', prevState, 'new state:', newState)
      },
      (reason) => {
        console.log('state change aborted. reason:', reason);
      }
    );

    const mediaSourceSocket: HTML5MediaSourceBufferSocket = new HTML5MediaSourceBufferSocket(mediaSource, 'video/mp4; codecs=avc1.4d401f');
    const mp4MuxProc = new MP4MuxProcessor();

    mp4MuxProc.out[0].connect(mediaSourceSocket);

    const mp4DemuxProc = new MP4DemuxProcessor();

    mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
      const demuxOutputSocket = <OutputSocket> data.socket;

      console.log('mp4 demux output created');

      ///*
      const socket = mp4MuxProc.addVideoTrack(
        MP4MuxProcessorSupportedCodecs.AVC,
        25, // fps
        768, 576, // resolution
        60
      );
      //*/

      const h264ParseProc = new H264ParseProcessor();

      demuxOutputSocket.connect(h264ParseProc.in[0]);

      h264ParseProc.out[0].connect(mp4MuxProc.in[0]);
    })

    const xhrSocket = this._xhrSocket = new XhrSocket(url);
    xhrSocket.connect(mp4DemuxProc.in[0]);

    this.add(mp4DemuxProc, mp4MuxProc);
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
