import { Flow, FlowStateChangeCallback } from '../core/flow';
import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { H264ParseProcessor } from '../processors/h264-parse.processor';
import { MP4MuxProcessor } from '../processors/mp4-mux-mozilla.processor';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { OutputSocket } from '../core/socket';
import { HTML5MediaSourceBufferSocket } from '../io-sockets/html5-media-source-buffer.socket';
import { MP3ParseProcessor } from '../processors/mp3-parse.processor';

export class MovToFmp4Flow extends Flow {

  constructor (movUrl: string, mp3Url: string, mediaSource: MediaSource) {
    super(
      (prevState, newState) => {
        console.log('previous state:', prevState, 'new state:', newState);
      },
      (reason) => {
        console.log('state change aborted. reason:', reason);
      }
    );

    const mp4DemuxProc = new MP4DemuxProcessor();

    const h264ParseProc = new H264ParseProcessor();
    const mp3ParseProc = new MP3ParseProcessor();

    const mp4MuxProc = new MP4MuxProcessor();

    const muxerVideoInput = mp4MuxProc.createInput();
    const muxerMp3Input = mp4MuxProc.createInput();

    const xhrSocketMovFile = new XhrSocket(movUrl);
    const xhrSocketMp3File = new XhrSocket(mp3Url);

    const mediaSourceSocket: HTML5MediaSourceBufferSocket
      = new HTML5MediaSourceBufferSocket(mediaSource /*, 'video/mp4; codecs=avc1.64001f'*/); // avc1.4d401f

    xhrSocketMovFile.connect(mp4DemuxProc.in[0]);
    xhrSocketMp3File.connect(mp3ParseProc.in[0]);

    mp3ParseProc.out[0].connect(muxerMp3Input);

    mediaSourceSocket.whenReady().then(() => {

      mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (eventData: ProcessorEventData) => {

        // FIXME: check the socket-descriptor actually is video

        console.log('mp4 demux output socket created');

        OutputSocket.unsafe(eventData.socket).connect(h264ParseProc.in[0]);
        h264ParseProc.out[0].connect(muxerVideoInput);
      });

      mp4MuxProc.out[0].connect(mediaSourceSocket);
    });

  }

  protected onVoidToWaiting_ (cb: FlowStateChangeCallback) {}

  protected onWaitingToVoid_ (cb: FlowStateChangeCallback) {}

  protected onWaitingToFlowing_ (cb: FlowStateChangeCallback) {}

  protected onFlowingToWaiting_ (cb: FlowStateChangeCallback) {}

  protected onStateChangeAborted_ (reason: string) {}
}
