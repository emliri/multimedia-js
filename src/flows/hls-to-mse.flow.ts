
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { MP2TSDemuxProcessor } from '../processors/mp2ts-demux.proc';
import { MP4MuxProcessor, MP4MuxProcessorOptions } from '../processors/mp4-mux-mozilla.processor';
import { H264ParseProcessor } from '../processors/h264-parse.processor';

import { MediaSourceInputSocket } from '../io-sockets/mse-input.socket';
import { HlsOutputSocket } from '../io-sockets/hls/hls-output-socket';

import { newProcessorWorkerShell, unsafeCastProcessorType } from '../core/processor-factory';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { Flow, FlowConfigFlag } from '../core/flow';
import { PayloadCodec } from '../core/payload-description';
import { OutputSocket, SocketEvent } from '../core/socket';

import { getLogger, LoggerLevel } from '../logger';

import { VoidCallback } from '../common-types';
import { ProcessorProxy } from '../core/processor-proxy';

const { log } = getLogger('HlsToMediaSourceFlow', LoggerLevel.ON, true);

const ENABLE_AUDIO = false
const ENABLE_VIDEO = true

const USE_TS_DEMUX = true;
export class HlsToMediaSourceFlow extends Flow {

  private _hlsOutSocket: HlsOutputSocket;
  private _mseInSocket: MediaSourceInputSocket;

  private _haveVideo = false;
  private _haveAudio = false;
  private _mediaSource: MediaSource;

  private mp4DemuxProc_: ProcessorProxy;
  private tsDemuxProc_: ProcessorProxy;
  private h264ParseProc_: ProcessorProxy;
  private mp4MuxProc_: ProcessorProxy;

  constructor (private _m3u8Url: string, private _videoEl: HTMLMediaElement) {
    super(
      FlowConfigFlag.NONE | FlowConfigFlag.WITH_DOWNLOAD_SOCKET,
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
    this._hlsOutSocket.load(this._m3u8Url);
    this._hlsOutSocket.whenReady().then(() => {
      this._mediaSource.duration = 10;
      this._hlsOutSocket.seek(0, 10);
    });
    done();
  }

  private onDemuxOutputCreated_ = (data: ProcessorEventData) => {
    log('demuxer output created');

    const demuxOutputSocket = <OutputSocket> data.socket;
    const payloadDescriptor = demuxOutputSocket.payload();

    let mp4MuxerInputSocket;

    if (data.processor === this.mp4DemuxProc_) {

      demuxOutputSocket.connect(this.h264ParseProc_.in[0]);
      mp4MuxerInputSocket = this.mp4MuxProc_.createInput();
      this.h264ParseProc_.out[0].connect(mp4MuxerInputSocket);

    } else if (data.processor === this.tsDemuxProc_) {

      if (!this._haveVideo &&
          PayloadCodec.isAvc(payloadDescriptor.codec)) {

        log('got video payload');
        this._haveVideo = true;

        demuxOutputSocket.connect(this.h264ParseProc_.in[0]);
        mp4MuxerInputSocket = this.mp4MuxProc_.createInput();
        this.h264ParseProc_.out[0].connect(mp4MuxerInputSocket);

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

  protected onVoidToWaiting_ (done: VoidCallback) {

    const mediaSource = this._mediaSource = new MediaSource();
    const inSocket = this._mseInSocket = new MediaSourceInputSocket(mediaSource, 'video/mp4');

    const mp4DemuxProc = this.mp4DemuxProc_ = newProcessorWorkerShell(MP4DemuxProcessor);
    const tsDemuxProc = this.tsDemuxProc_ = newProcessorWorkerShell(MP2TSDemuxProcessor);
    const h264ParseProc = this.h264ParseProc_ = newProcessorWorkerShell(H264ParseProcessor);
    const mp4MuxOptions: Partial<MP4MuxProcessorOptions> = {
      fragmentedMode: true
    }
    const mp4MuxProc = this.mp4MuxProc_ = newProcessorWorkerShell(unsafeCastProcessorType(MP4MuxProcessor), [mp4MuxOptions]);

    const outSocket = this._hlsOutSocket = new HlsOutputSocket();

    this.addProc(mp4DemuxProc, mp4MuxProc, tsDemuxProc, mp4MuxProc);

    tsDemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, this.onDemuxOutputCreated_.bind(this));
    mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, this.onDemuxOutputCreated_.bind(this));

    if (USE_TS_DEMUX) { // FIXME use mime-type of response
      outSocket.connect(tsDemuxProc.in[0]);
    } else { // FIXME use mime-type of response
      outSocket.connect(mp4DemuxProc.in[0]);
    }

    mp4MuxProc.out[0].connect(inSocket);
    //this.connectWithAllExternalSockets(mp4MuxProc.out[0]);

    this._videoEl.src = URL.createObjectURL(mediaSource);
    this._videoEl.play();

    done();
  }

  protected onWaitingToVoid_ (done: VoidCallback) {
    done();
  }

  protected onFlowingToWaiting_ (done: VoidCallback) {
    done();
  }

  protected onCompleted_ (done: VoidCallback) {
    done();
  }

  protected onStateChangeAborted_ (reason: string) {}
}
