import { Flow, FlowCompletionResultCode, FlowConfigFlag } from '../core/flow';
import { XhrSocket } from '../io-sockets/xhr.socket';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { H264ParseProcessor } from '../processors/h264-parse.processor';
import { MP4MuxProcessor } from '../processors/mp4-mux-mozilla.processor';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { OutputSocket } from '../core/socket';
import { MP3ParseProcessor } from '../processors/mp3-parse.processor';
import { newProcessorWorkerShell, unsafeProcessorType } from '../core/processor-factory';
import { getLogger } from '../logger';
import { FFmpegConversionTargetInfo } from '../processors/ffmpeg/ffmpeg-tool';
import { FFmpegConvertProcessor } from '../processors/ffmpeg-convert.processor';
import { makeTemplate } from '../common-utils';
import { EnvironmentVars } from '../core/env';
import { VoidCallback } from '../common-types';

const { log } = getLogger('CombineMp4sToMovFlow');

export class CombineMp4sToMovFlow extends Flow {
  /**
   *
   * @param _videoMp4Url
   * @param _audioUrl
   * @param _appInputCallback
   * @param _useFileDownloadSocket
   * @param _downloadLinkContainer
   * @param _isMp3Audio
   */
  constructor (
    private _videoMp4Url: string,
    private _audioUrl: string,
    useFileDownloadSocket: boolean = false,
    downloadLinkContainer: HTMLElement = null,
    private _isMp3Audio: boolean = false
  ) {
    super(
      FlowConfigFlag.WITH_APP_SOCKET |
      (useFileDownloadSocket && FlowConfigFlag.WITH_DOWNLOAD_SOCKET),
      null,
      null,
      {
        el: downloadLinkContainer,
        mimeType: 'video/quicktime',
        filenameTemplateBase: 'buffer${counter}-${Date.now()}.mp4'
      }
    )
  }

  private _setup () {
    {
      let ffmpegAacTranscodeProc = null;
      if (this._isMp3Audio) { // the url might point to a blob so the file extension is not a criteria
        const audioConfig: FFmpegConversionTargetInfo = {
          targetBitrateKbps: 256,
          targetCodec: 'aac',
          targetFiletypeExt: 'mp4'
        };

        log('using ffmpeg.js bin path:', EnvironmentVars.FFMPEG_BIN_PATH);

        ffmpegAacTranscodeProc = newProcessorWorkerShell(
          unsafeProcessorType(FFmpegConvertProcessor), // WHY ?
          [audioConfig, null],
          [EnvironmentVars.FFMPEG_BIN_PATH]
        );
      }

      const mp4DemuxProcVideo = newProcessorWorkerShell(MP4DemuxProcessor);
      const h264ParseProc = newProcessorWorkerShell(H264ParseProcessor);
      const mp3ParseProc = newProcessorWorkerShell(MP3ParseProcessor);

      const mp4MuxProc = newProcessorWorkerShell(MP4MuxProcessor);

      this.add(mp4DemuxProcVideo, h264ParseProc, mp3ParseProc, mp4MuxProc);

      const muxerVideoInput = mp4MuxProc.createInput();
      const muxerAudioInput = mp4MuxProc.createInput();

      const xhrSocketMovFile = new XhrSocket(this._videoMp4Url);
      const xhrSocketAudioFile = new XhrSocket(this._audioUrl);

      /*
      const mediaSourceSocket: HTML5MediaSourceBufferSocket
          = new HTML5MediaSourceBufferSocket(new MediaSource()); // avc1.4d401f 'video/mp4; codecs=avc1.64001f'
      */

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
      mp4DemuxProcVideo.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (eventData: ProcessorEventData) => {

        if (!eventData.socket.descriptor().payload().isVideo()) {
          // ignore
          return;
        }

        // FIXME: check the socket-descriptor actually is video
        log('mp4 video demux output socket created');

        // FIXME: avoid the unsafe cast here somehow?
        OutputSocket.fromUnsafe(eventData.socket).connect(h264ParseProc.in[0]);

        h264ParseProc.out[0].connect(muxerVideoInput);
      });

      mp4DemuxProcAudio.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (eventData: ProcessorEventData) => {
        log('mp4 video demux output socket created');

        OutputSocket.fromUnsafe(eventData.socket).connect(muxerAudioInput);
      });


      this.connectWithAllExternalSockets(mp4MuxProc[0])

    }
  }

  protected onVoidToWaiting_ (cb: VoidCallback) {
    cb();
  }

  protected onWaitingToVoid_ (cb: VoidCallback) {
    cb();
  }

  protected onWaitingToFlowing_ (cb: VoidCallback) {
    this._setup();
    cb();
  }

  protected onFlowingToWaiting_ (cb: VoidCallback) {
    cb();
  }

  protected onCompleted_ (cb: VoidCallback) {
    cb();
  }

  protected onStateChangeAborted_ (reason: string) {

  }
}
