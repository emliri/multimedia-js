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

    const mp4DemuxProc = new MP4DemuxProcessor();
    const tsDemuxProc = new MPEGTSDemuxProcessor();
    const h264ParseProc = new H264ParseProcessor();
    const mp4MuxProc = new MP4MuxProcessor();

    const xhrSocket = this._xhrSocket = new XhrSocket(url);
    const mediaSourceSocket: HTML5MediaSourceBufferSocket = new HTML5MediaSourceBufferSocket(mediaSource, 'video/mp4; codecs=avc1.4d401f');

    tsDemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);
    mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);

    mp4MuxProc.out[0].connect(mediaSourceSocket);

    if (url.endsWith('.ts')) { // FIXME use mime-type of response
      xhrSocket.connect(tsDemuxProc.in[0]);
    } else { // FIXME use mime-type of response
      xhrSocket.connect(mp4DemuxProc.in[0]);
    }

    this.add(mp4DemuxProc, tsDemuxProc, mp4MuxProc);

    function onDemuxOutputCreated(data: ProcessorEventData) {
      const demuxOutputSocket = <OutputSocket> data.socket;

      console.log('demuxer output created');

      let muxerInputSocket;

      if (data.processor === mp4DemuxProc) {

        muxerInputSocket = mp4MuxProc.addVideoTrack(
          MP4MuxProcessorSupportedCodecs.AVC,
          25, // fps
          768, 576, // resolution
          60 // duration
        );


      } else if (data.processor === tsDemuxProc) {

        muxerInputSocket = mp4MuxProc.addVideoTrack(
          MP4MuxProcessorSupportedCodecs.AVC,
          60, // fps
          1280, 720, // resolution
          10 // duration
        );
      }

      demuxOutputSocket.connect(h264ParseProc.in[0]);
      h264ParseProc.out[0].connect(muxerInputSocket);
    }
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
