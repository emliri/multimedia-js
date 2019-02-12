import { Flow, FlowStateChangeCallback } from '../core/flow';
import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { H264ParseProcessor } from '../processors/h264-parse.processor';
import { MP4MuxProcessor } from '../processors/mp4-mux-mozilla.processor';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { OutputSocket, SocketEvent } from '../core/socket';
import { MP3ParseProcessor } from '../processors/mp3-parse.processor';
import { WebFileDownloadSocket } from '../io-sockets/web-file-download.socket';
import { newProcessorWorkerShell, unsafeProcessorType } from '../core/processor-factory';
import { getLogger } from '../logger';
import { FFmpegConversionTargetInfo } from '../processors/ffmpeg/ffmpeg-tool';
import { FFmpegConvertProcessor } from '../processors/ffmpeg-convert.processor';
import { makeTemplate } from '../common-utils';
import { EnvironmentVars } from "../core/env";
import { VoidCallback } from '../common-types';

const { log } = getLogger('CombineMp4sToMovFlow');

export class CombineMp4sToMovFlow extends Flow {

  constructor (videoMp4Url: string, audioUrl: string, downloadLinkContainer: HTMLElement, isMp3Audio: boolean = false) {

    super(
      (prevState, newState) => {
        console.log('previous state:', prevState, 'new state:', newState);
      },
      (reason) => {
        console.log('state change aborted. reason:', reason);
      }
    );

    {
      let ffmpegAacTranscodeProc = null;
      if (isMp3Audio) { // the url might point to a blob so the file extension is not a criteria

        const audioConfig: FFmpegConversionTargetInfo = {
          targetBitrateKbps: 256,
          targetCodec: 'aac',
          targetFiletypeExt: 'mp4'
        }

        log('using ffmpeg.js bin path:', EnvironmentVars.FFMPEG_BIN_PATH)

        ffmpegAacTranscodeProc = newProcessorWorkerShell(
          unsafeProcessorType(FFmpegConvertProcessor),
          [audioConfig, null],
          [EnvironmentVars.FFMPEG_BIN_PATH]
        );

      }

      const mp4DemuxProcVideo = newProcessorWorkerShell(MP4DemuxProcessor)
      const h264ParseProc = newProcessorWorkerShell(H264ParseProcessor);
      const mp3ParseProc = newProcessorWorkerShell(MP3ParseProcessor);

      const mp4MuxProc = newProcessorWorkerShell(MP4MuxProcessor);

      const muxerVideoInput = mp4MuxProc.createInput();
      const muxerAudioInput = mp4MuxProc.createInput();

      const xhrSocketMovFile = new XhrSocket(videoMp4Url);
      const xhrSocketAudioFile = new XhrSocket(audioUrl);

      /*
      const mediaSourceSocket: HTML5MediaSourceBufferSocket
          = new HTML5MediaSourceBufferSocket(new MediaSource()); // avc1.4d401f 'video/mp4; codecs=avc1.64001f'
      */

      const downloadSocket: WebFileDownloadSocket
        = new WebFileDownloadSocket(downloadLinkContainer, 'video/quicktime', makeTemplate('buffer${counter}-${Date.now()}.mp4'));

      const destinationSocket = downloadSocket;

      let mp4DemuxProcAudio = newProcessorWorkerShell(MP4DemuxProcessor);

      // hook up transcoding stage
      let mp4AudioOutSocket = xhrSocketAudioFile;
      if (ffmpegAacTranscodeProc) {
        xhrSocketAudioFile.connect(ffmpegAacTranscodeProc.in[0]);
        mp4AudioOutSocket = ffmpegAacTranscodeProc.out[0];
      }
      mp4AudioOutSocket.connect(mp4DemuxProcAudio.in[0]);

      // DEPRECATED: support for mp3 ES in MP4 file (untranscoded)
      // wire up audio data source
      /*
      if (audioUrl.endsWith('.mp3')) {
        xhrSocketAudioFile.connect(mp3ParseProc.in[0]);
        mp3ParseProc.out[0].connect(muxerAudioInput);
      } else { // TODO: check using mimetypes from XHR
        // assuming mp4a
        mp4DemuxProcAudio = newProcessorWorkerShell(MP4DemuxProcessor);
        xhrSocketAudioFile.connect(mp4DemuxProcAudio.in[0]);
      }
      */

      // wire up video
      xhrSocketMovFile.connect(mp4DemuxProcVideo.in[0]);

      // set up
      destinationSocket.whenReady().then(() => {

        mp4DemuxProcVideo.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (eventData: ProcessorEventData) => {

          // FIXME: check the socket-descriptor actually is video
          log('mp4 video demux output socket created');

          // FIXME: avoid the unsafe cast here somehow?
          OutputSocket.fromUnsafe(eventData.socket).connect(h264ParseProc.in[0]);

          h264ParseProc.out[0].connect(muxerVideoInput);
        });

      });

      mp4DemuxProcAudio.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (eventData: ProcessorEventData) => {

        log('mp4 video demux output socket created');

        OutputSocket.fromUnsafe(eventData.socket).connect(muxerAudioInput);

      });

      mp4MuxProc.out[0].connect(destinationSocket);

      this.getExternalSockets().add(destinationSocket);

    }

  }

  protected onVoidToWaiting_ (cb: VoidCallback) {}

  protected onWaitingToVoid_ (cb: VoidCallback) {}

  protected onWaitingToFlowing_ (cb: VoidCallback) {}

  protected onFlowingToWaiting_ (cb: VoidCallback) {}

  protected onCompleted_(done: VoidCallback) {}

  protected onStateChangeAborted_ (reason: string) {}
}
