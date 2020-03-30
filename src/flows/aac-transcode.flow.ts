import { Flow } from '../core/flow';
import { VoidCallback } from '../common-types';
import { FFmpegConversionTargetInfo } from '../processors/ffmpeg/ffmpeg-tool';
import { FFmpegConvertProcessor } from '../processors/ffmpeg-convert.processor';
import { newProcessorWorkerShell, unsafeCastProcessorType } from '../core/processor-factory';
import { MP4MuxProcessor } from '../processors/mp4-mux-mozilla.processor';
import { EnvironmentVars } from '../..';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { OutputSocket, InputSocket, SocketDescriptor } from '../core/socket';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { getLogger, LoggerLevel } from '../logger';

const { debug, log } = getLogger('AacTranscodeFlow', LoggerLevel.ON, true);

export class AacTranscodeFlow extends Flow {
  constructor (private _outputBitrateKbps: number = 256, private _forceReencode: boolean = true) {
    super();

    this._setup();
  }

  private _setup () {
    const audioConfigRetranscode: FFmpegConversionTargetInfo = {
      targetBitrateKbps: 2 * this._outputBitrateKbps, // *** // bitrate value will be ignored by ffmpeg either way for WAV
      targetCodec: 'mp3',
      targetFiletypeExt: 'mp3'
    };

    const audioConfigOut: FFmpegConversionTargetInfo = {
      targetBitrateKbps: this._outputBitrateKbps,
      targetCodec: 'aac',
      targetFiletypeExt: 'mp4'
    };

    const aacTranscoderMp4Demux = newProcessorWorkerShell(MP4DemuxProcessor);
    const aacTranscoderMp4Mux = newProcessorWorkerShell(unsafeCastProcessorType(MP4MuxProcessor));
    const aacTranscoder = newProcessorWorkerShell(
      unsafeCastProcessorType(FFmpegConvertProcessor),
      [audioConfigOut, null],
      [EnvironmentVars.FFMPEG_BIN_PATH]
    );

    this.addProc(aacTranscoderMp4Demux, aacTranscoderMp4Mux, aacTranscoder);

    let aacRetranscode = null;
    if (this._forceReencode) {
      aacRetranscode = newProcessorWorkerShell(
        unsafeCastProcessorType(FFmpegConvertProcessor),
        [audioConfigRetranscode, null],
        [EnvironmentVars.FFMPEG_BIN_PATH]
      );
      this.addProc(aacRetranscode);
    }

    if (!aacRetranscode) {
      aacTranscoderMp4Mux.out[0].connect(aacTranscoder.in[0]);
      aacTranscoder.out[0].connect(aacTranscoderMp4Demux.in[0]);
    } else {
      aacTranscoderMp4Mux.out[0].connect(aacRetranscode.in[0]);
      aacRetranscode.out[0].connect(aacTranscoder.in[0]);
      aacTranscoder.out[0].connect(aacTranscoderMp4Demux.in[0]);
    }

    const aacTranscodeIn = aacTranscoderMp4Mux.createInput();
    const aacTranscodeOut = new OutputSocket(SocketDescriptor.fromMimeType('audio/aac'));

    this.addExternalSocket(aacTranscodeIn);
    this.addExternalSocket(aacTranscodeOut);

    aacTranscoderMp4Demux.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
      log('aac transcoder demux output socket created');

      const socket = OutputSocket.fromUnsafe(data.socket);
      socket.connect(aacTranscodeOut);
    });
  }

  protected onVoidToWaiting_ (done: VoidCallback) {
    done();
  }

  protected onWaitingToVoid_ (done: VoidCallback) {
    done();
  }

  protected onWaitingToFlowing_ (done: VoidCallback) {
    done();
  }

  protected onFlowingToWaiting_ (done: VoidCallback) {
    done();
  }

  protected onCompleted_ (done: VoidCallback) {
    done();
  }

  protected onStateChangeAborted_ (reason: string) {
    //
  }
}
