import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { MP2TSDemuxProcessor } from '../processors/mp2ts-demux.proc';
import { MP4MuxProcessor } from '../processors/mp4-mux-mozilla.processor';
import { Flow, FlowConfigFlag } from '../core/flow';
import { OutputSocket } from '../core/socket';
import { AvcPayloaderProc } from '../processors/avc-network-abstraction.proc';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { getLogger, LoggerLevel } from '../logger';
import { PayloadCodec } from '../core/payload-description';
import { VoidCallback } from '../common-types';
import { newProcessorWorkerShell, unsafeCastProcessorType } from '../core/processor-factory';

const { log } = getLogger('ChunkToMediaSourceFlow', LoggerLevel.ON, true);

const ENABLE_AUDIO = false;
const ENABLE_VIDEO = true;
export class ChunkToMediaSourceFlow extends Flow {
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
    const tsDemuxProc = newProcessorWorkerShell(MP2TSDemuxProcessor);
    const h264ParseProc = newProcessorWorkerShell(unsafeCastProcessorType(AvcPayloaderProc));
    const mp4MuxProc = newProcessorWorkerShell(unsafeCastProcessorType(MP4MuxProcessor));

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

    this.addProc(mp4DemuxProc, tsDemuxProc, mp4MuxProc);

    tsDemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);
    mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, onDemuxOutputCreated);

    if (this._url.endsWith('.ts')) { // FIXME use mime-type of response
      xhrSocket.connect(tsDemuxProc.in[0]);
    } else { // FIXME use mime-type of response
      xhrSocket.connect(mp4DemuxProc.in[0]);
    }

    this.connectWithAllExternalSockets(mp4MuxProc.out[0]);

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
