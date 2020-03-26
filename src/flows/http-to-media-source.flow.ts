import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { MPEGTSDemuxProcessor } from '../processors/mpeg-ts-demux.processor';
import { MP4MuxProcessor } from '../processors/mp4-mux-mozilla.processor';
import { Flow, FlowConfigFlag } from '../core/flow';
import { OutputSocket } from '../core/socket';
import { H264ParseProcessor } from '../processors/h264-parse.processor';
import { HTML5MediaSourceBufferSocket } from '../io-sockets/html5-media-source-buffer.socket';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { getLogger, LoggerLevel } from '../logger';
import { PayloadCodec } from '../core/payload-description';
import { VoidCallback } from '../common-types';
import { newProcessorWorkerShell } from '../core/processor-factory';

const { log } = getLogger('HttpToMediaSourceFlow', LoggerLevel.ON, true);

const ENABLE_AUDIO = false
const ENABLE_VIDEO = true
export class HttpToMediaSourceFlow extends Flow {

  private _xhrSocket: XhrSocket;

  private _haveVideo = false;
  private _haveAudio = false;

  constructor (private _url: string) {
    super(
      FlowConfigFlag.NONE | FlowConfigFlag.WITH_DOWNLOAD_SOCKET | FlowConfigFlag.WITH_APP_SOCKET,
      (prevState, newState) => {
        log('previous state:', prevState, 'new state:', newState);
      },
      (reason) => {
        log('state change aborted. reason:', reason);
      },
      { el: null, mimeType: 'video/mp4', filenameTemplateBase: 'dump-${new Date().toJSON()}.mp4' }
    );
  }

  protected onWaitingToFlowing_ (done: VoidCallback) {
    const mp4DemuxProc = newProcessorWorkerShell(MP4DemuxProcessor);
    const tsDemuxProc = newProcessorWorkerShell(MPEGTSDemuxProcessor);
    const h264ParseProc = newProcessorWorkerShell(H264ParseProcessor);
    const mp4MuxProc = newProcessorWorkerShell(MP4MuxProcessor);

    const xhrSocket = this._xhrSocket = new XhrSocket(this._url);

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

          log('got video payload');

          this._haveVideo = true;

          demuxOutputSocket.connect(h264ParseProc.in[0]);
          muxerInputSocket = mp4MuxProc.createInput();
          h264ParseProc.out[0].connect(muxerInputSocket);

        } else if (!this._haveAudio &&
            PayloadCodec.isAac(payloadDescriptor.codec)) {

          log('got audio payload');

          /*
          this._haveAudio = true;
          muxerInputSocket = mp4MuxProc.createInput();
          demuxOutputSocket.connect(muxerInputSocket);
          */

        }
      }
    };

    this.addProc(mp4DemuxProc, mp4MuxProc, tsDemuxProc, mp4MuxProc);

    tsDemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);
    mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);

    if (this._url.endsWith('.ts')) { // FIXME use mime-type of response
      xhrSocket.connect(tsDemuxProc.in[0]);
    } else { // FIXME use mime-type of response
      xhrSocket.connect(mp4DemuxProc.in[0]);
    }

    this.connectWithAllExternalSockets(mp4MuxProc.out[0])

    done();
  }

  protected onFlowingToWaiting_ (done: VoidCallback) {
    done();
  }

  protected onCompleted_ (done: VoidCallback) {
    done();
  }

  protected onVoidToWaiting_ (done: VoidCallback) {
    done();
  }

  protected onWaitingToVoid_ (done: VoidCallback) {
    done();
  }

  protected onStateChangeAborted_ (reason: string) {
  }
}
