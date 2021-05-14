import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4MuxProcessor, MP4MuxProcessorOptions } from '../processors/mp4-mux-mozilla.processor';
import { MP3ParseProcessor } from '../processors/mp3-parse.processor';

import { Flow, FlowConfigFlag } from '../core/flow';
import { newProcessorWorkerShell, unsafeCastProcessorType } from '../core/processor-factory';

import { getLogger, LoggerLevel } from '../logger';
import { VoidCallback } from '../common-types';

const { log } = getLogger('ChunkToMediaSourceFlow', LoggerLevel.ON, true);

export class ElementaryStreamToMp4 extends Flow {
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
    const mp3ParseProc = newProcessorWorkerShell(MP3ParseProcessor);

    const mp4MuxOptions: Partial<MP4MuxProcessorOptions> = {
      fragmentedMode: false,
      forceMp3: true
    };
    const mp4MuxProc = newProcessorWorkerShell(unsafeCastProcessorType(MP4MuxProcessor), [mp4MuxOptions]);

    const xhrSocket = new XhrSocket(this._url);
    xhrSocket.connect(mp3ParseProc.in[0]);

    const mp4MuxIn = mp4MuxProc.createInput();
    mp3ParseProc.out[0].connect(mp4MuxIn);

    this.addProc(mp3ParseProc, mp4MuxProc);
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
