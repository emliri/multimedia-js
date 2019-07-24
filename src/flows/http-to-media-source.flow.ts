import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { MPEGTSDemuxProcessor } from '../processors/mpeg-ts-demux.processor';
import { MP4MuxProcessor, MP4MuxProcessorSupportedCodecs } from '../processors/mp4-mux-mozilla.processor';
import { Flow, FlowStateChangeCallback, FlowConfigFlag } from '../core/flow';
import { Socket, OutputSocket } from '../core/socket';
import { H264ParseProcessor } from '../processors/h264-parse.processor';
import { HTML5MediaSourceBufferSocket } from '../io-sockets/html5-media-source-buffer.socket';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { getLogger } from '../logger';
import { PayloadCodec } from '../core/payload-description';
import { VoidCallback } from '../common-types';

const { log } = getLogger('HttpToMediaSourceFlow');

export class HttpToMediaSourceFlow extends Flow {
  private _xhrSocket: XhrSocket;

  private _haveVideo = false;
  private _haveAudio = false;

  constructor (url: string, mediaSource: MediaSource) {
    super(
      FlowConfigFlag.NONE,
      (prevState, newState) => {
        log('previous state:', prevState, 'new state:', newState);
      },
      (reason) => {
        log('state change aborted. reason:', reason);
      }
    );

    const mp4DemuxProc = new MP4DemuxProcessor();
    const tsDemuxProc = new MPEGTSDemuxProcessor();
    const h264ParseProc = new H264ParseProcessor();
    const mp4MuxProc = new MP4MuxProcessor();

    const xhrSocket = this._xhrSocket = new XhrSocket(url);

    const mediaSourceSocket: HTML5MediaSourceBufferSocket =
      new HTML5MediaSourceBufferSocket(mediaSource); // avc1.4d401f

    const onDemuxOutputCreated = (data: ProcessorEventData) => {
      const demuxOutputSocket = <OutputSocket> data.socket;

      log('demuxer output created');

      let muxerInputSocket;

      const payloadDescriptor = demuxOutputSocket.payload();

      if (data.processor === mp4DemuxProc) {
        demuxOutputSocket.connect(h264ParseProc.in[0]);
        muxerInputSocket = mp4MuxProc.createInput();
        h264ParseProc.out[0].connect(muxerInputSocket);
      } else if (data.processor === tsDemuxProc) {
        if (!this._haveVideo &&
            PayloadCodec.isAvc(payloadDescriptor.codec)) {
          this._haveVideo = true;
          muxerInputSocket = mp4MuxProc.createInput();
          h264ParseProc.out[0].connect(muxerInputSocket);
          demuxOutputSocket.connect(h264ParseProc.in[0]);
        } else if (!this._haveAudio &&
            PayloadCodec.isAac(payloadDescriptor.codec)) {
          this._haveAudio = true;
          muxerInputSocket = mp4MuxProc.createInput();
          demuxOutputSocket.connect(muxerInputSocket);
        }
      }
    };

    this.add(mp4DemuxProc, mp4MuxProc, tsDemuxProc, mp4MuxProc);

    tsDemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);
    mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);

    mp4MuxProc.out[0].connect(mediaSourceSocket);
    mp4MuxProc.out[0].connect(mediaSourceSocket);

    if (url.endsWith('.ts')) { // FIXME use mime-type of response
      xhrSocket.connect(tsDemuxProc.in[0]);
    } else { // FIXME use mime-type of response
      xhrSocket.connect(mp4DemuxProc.in[0]);
    }
  }

  /**
   * @override
   */
  getExternalSockets (): Set<Socket> {
    return new Set([this._xhrSocket]);
  }

  protected onCompleted_ (done: VoidCallback) {}

  protected onVoidToWaiting_ (done: VoidCallback) {}

  protected onWaitingToVoid_ (done: VoidCallback) {}

  protected onWaitingToFlowing_ (done: VoidCallback) {}

  protected onFlowingToWaiting_ (done: VoidCallback) {}

  protected onStateChangeAborted_ (reason: string) {}
}
