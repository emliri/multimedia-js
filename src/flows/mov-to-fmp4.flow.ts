import { Flow, FlowStateChangeCallback } from '../core/flow';
import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { H264ParseProcessor } from '../processors/h264-parse.processor';
import { MP4MuxProcessor, MP4MuxProcessorSupportedCodecs } from '../processors/mp4-mux-mozilla.processor';
import { ProcessorEvent, ProcessorEventHandler, ProcessorEventData } from '../core/processor';
import { OutputSocket } from '../core/socket';
import { HTML5MediaSourceBufferSocket } from '../io-sockets/html5-media-source-buffer.socket';

export class MovToFmp4Flow extends Flow {

  constructor (movUrl: string, mediaSource: MediaSource) {
    super(
      (prevState, newState) => {
        console.log('previous state:', prevState, 'new state:', newState);
      },
      (reason) => {
        console.log('state change aborted. reason:', reason);
      }
    );

    //const isoboxerMp4DemuxProc = new IsoboxerMP4DemuxProcessor();

    const h264ParseProc = new H264ParseProcessor();
    const mp4MuxProc = new MP4MuxProcessor();
    const mp4DemuxProc = new MP4DemuxProcessor();
    const xhrSocket = new XhrSocket(movUrl);
    const mediaSourceSocket: HTML5MediaSourceBufferSocket
      = new HTML5MediaSourceBufferSocket(mediaSource, 'video/mp4; codecs=avc1.64001f'); // avc1.4d401f

    mediaSourceSocket.whenReady().then(() => {

      xhrSocket.connect(mp4DemuxProc.in[0]);

      mp4MuxProc.out[0].connect(mediaSourceSocket);

      mp4DemuxProc.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (eventData: ProcessorEventData) => {

        (<OutputSocket> eventData.socket).connect(h264ParseProc.in[0]);

        const muxerInput = mp4MuxProc.addVideoTrack(
          MP4MuxProcessorSupportedCodecs.AVC,
          // FIXME: get actual infos here from demuxer packets
          25, // fps
          768, 576, // resolution
          60 // duration
        );

        h264ParseProc.out[0].connect(muxerInput);
      });

    });

  }

  protected onVoidToWaiting_ (cb: FlowStateChangeCallback) {}

  protected onWaitingToVoid_ (cb: FlowStateChangeCallback) {}

  protected onWaitingToFlowing_ (cb: FlowStateChangeCallback) {}

  protected onFlowingToWaiting_ (cb: FlowStateChangeCallback) {}

  protected onStateChangeAborted_ (reason: string) {}
}
