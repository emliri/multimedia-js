import { Flow } from "../core/flow";
import { VoidCallback } from "../common-types";
import { XhrSocket } from "../io-sockets/xhr.socket";
import { newProcessorWorkerShell, unsafeProcessorType } from "../core/processor-factory";
import { MP4DemuxProcessor } from "../processors/mp4-demux.processor";
import { ProcessorEvent, ProcessorEventData } from "../core/processor";
import { OutputSocket, SocketEvent, InputSocket, Socket } from "../core/socket";
import { FifoValve, wrapOutputSocketWithValve } from "../core/fifo";
import { getLogger, LoggerLevel } from "../logger";
import { PayloadDescriptor } from "../core/payload-description";
import { FFmpegConversionTargetInfo } from "../processors/ffmpeg/ffmpeg-tool";
import { EnvironmentVars } from "../core/env";
import { FFmpegConvertProcessor } from "../processors/ffmpeg-convert.processor";
import { MP4MuxProcessor } from "../processors/mp4-mux-mozilla.processor";
import { PacketSymbol } from "../core/packet";
import { WebFileDownloadSocket } from "../io-sockets/web-file-download.socket";
import { makeTemplate } from "../common-utils";

const { log } = getLogger("ConcatMp4sFlow", LoggerLevel.ON, true);

export class ConcatMp4sFlow extends Flow {

    /**
     *
     * @param _movUrlA First file URL
     * @param _movUrlB Second file URL
     * @param _allowReencode defaults to true. when true will re-encode to Bs tracks to As respective audio/video configurations
     * @param _toggleConcatOrder defaults to false. if true will toggle order of concatenation (B before A, but not changing re-encode behavior of course)
     */
    constructor(
        private _movUrlA: string,
        private _movUrlB:  string,
        private _allowReencode: boolean = true,
        private _toggleConcatOrder: boolean = false
    ) {
        super();
    }

    private _setup() {

      const xhrSocketMovA = new XhrSocket(this._movUrlA);
      const xhrSocketMovB = new XhrSocket(this._movUrlB);

      let fifoVideoA: FifoValve = null;
      let fifoAudioA: FifoValve = null;

      let fifoVideoB: FifoValve = null;
      let fifoAudioB: FifoValve = null;

      const mp4DemuxA = newProcessorWorkerShell(MP4DemuxProcessor);
      const mp4DemuxB = newProcessorWorkerShell(MP4DemuxProcessor);

      const mp4Muxer = newProcessorWorkerShell(MP4MuxProcessor);

      let mp4MuxerVideoIn: InputSocket = mp4Muxer.createInput();
      let mp4MuxerAudioIn: InputSocket; // = mp4Muxer.createInput();

      const transcoderAudioConfig: FFmpegConversionTargetInfo = {
        targetBitrateKbps: 256,
        targetCodec: 'aac',
        targetFiletypeExt: 'mp4'
      };

      const transcoderVideoConfig: FFmpegConversionTargetInfo = {
        targetBitrateKbps: 256,
        targetCodec: 'libx264',
        targetFiletypeExt: 'h264'
      };

      log('using ffmpeg.js bin path:', EnvironmentVars.FFMPEG_BIN_PATH);

      const ffmpegTranscoder = newProcessorWorkerShell(
        unsafeProcessorType(FFmpegConvertProcessor), // WHY ?
        [transcoderAudioConfig, transcoderVideoConfig],
        [EnvironmentVars.FFMPEG_BIN_PATH]
      );

      let payloadDescrVideoA: PayloadDescriptor = null;
      let payloadDescrAudioA: PayloadDescriptor = null;

      let payloadDescrVideoB: PayloadDescriptor = null;
      let payloadDescrAudioB: PayloadDescriptor = null;

      let durationA: number;
      let durationB: number;

      let videoBeosReceived = false;
      let videoAeosDroped = false;

      function attemptDrainVideoBFifo() {

        if (videoAeosDroped && videoBeosReceived) {

          durationA = Math.max(payloadDescrAudioA ? payloadDescrAudioA.details.sequenceDurationInSeconds : 0,
                                payloadDescrVideoA ? payloadDescrVideoA.details.sequenceDurationInSeconds : 0);

          log('max duration of primary payload (input A):', durationA, 'secs')

          durationB = Math.max(payloadDescrAudioB ? payloadDescrAudioB.details.sequenceDurationInSeconds : 0,
            payloadDescrVideoB ? payloadDescrVideoB.details.sequenceDurationInSeconds : 0);

          log('max duration of secondary payload (input B):', durationB, 'secs')

          payloadDescrVideoA.details.sequenceDurationInSeconds = durationA + durationB;

          // TODO:
          //payloadDescrAudioA.details.sequenceDurationInSeconds = durationA + durationB;

          fifoVideoB.drain();
        }

      }

      mp4DemuxA.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {

        const socket: Socket = data.socket;

        if (socket.payload().isVideo()) {

          fifoVideoA = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {});
          fifoVideoA.connect(mp4MuxerVideoIn)

          fifoVideoA.addPacketFilterPass((p) => {

            if (p.symbol === PacketSymbol.EOS) {
              p.symbol = PacketSymbol.SYNC;

              videoAeosDroped = true;

              attemptDrainVideoBFifo()

            }
            return p;

          });

          fifoVideoA.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
            log('video A EOS received on fifo queue')

            fifoVideoA.drain();
          });

          // could move that into valve CB ?
          socket.on(SocketEvent.ANY_PACKET_TRANSFERRED, () => {

            if (!payloadDescrVideoA) {
              payloadDescrVideoA = fifoVideoA.queue.peek().defaultPayloadInfo;
              log('got primary video payload description:', payloadDescrVideoA)
            }

          });

        } else if (socket.payload().isAudio()) {

          fifoAudioA = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {});
          fifoAudioA.connect(mp4MuxerAudioIn)

          // could move that into valve CB ?
          socket.on(SocketEvent.ANY_PACKET_TRANSFERRED, () => {

            if (!payloadDescrAudioA) {
              payloadDescrAudioA = fifoAudioA.queue.peek().defaultPayloadInfo;
              log('got primary audio payload description:', payloadDescrAudioA)
            }

          });

        }

      });

      mp4DemuxB.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {

        const socket: Socket = data.socket;

        if (socket.payload().isVideo()) {

          fifoVideoB = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {});
          fifoVideoB.connect(mp4MuxerVideoIn)

          fifoVideoB.addPacketFilterPass((p) => {

            if (p.defaultPayloadInfo && p.defaultPayloadInfo.isBitstreamHeader) {
              log('found secondary payload bitstream header')
            }

            p.timestamp = p.timestamp
              + (p.getTimescale() * durationA)

            return p;
          })

          fifoVideoB.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
            log('video B EOS received on fifo queue')

            videoBeosReceived = true;

            attemptDrainVideoBFifo()

          });

          // could move that into valve CB ?
          socket.on(SocketEvent.ANY_PACKET_TRANSFERRED, () => {

            if (!payloadDescrVideoB) {
              payloadDescrVideoB = fifoVideoB.queue.peek().defaultPayloadInfo;
              log('got secondary video payload description:', payloadDescrVideoB)
            }

          });

        } else if (socket.payload().isAudio()) {

          fifoAudioB = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {});
          fifoAudioB.connect(mp4MuxerAudioIn)

          // could move that into valve CB ?
          socket.on(SocketEvent.ANY_PACKET_TRANSFERRED, () => {

            if (!payloadDescrAudioB) {
              payloadDescrAudioB = fifoAudioB.queue.peek().defaultPayloadInfo;
              log('got secondary audio payload description:', payloadDescrAudioB)
            }

          });
        }

      });

      xhrSocketMovA.connect(mp4DemuxA.in[0])
      xhrSocketMovB.connect(mp4DemuxB.in[0])

      mp4Muxer.out[0].connect(
        new WebFileDownloadSocket(null, 'video/mp4', makeTemplate('buffer${counter}-${Date.now()}.mp4')))

    }

    protected onVoidToWaiting_(done: VoidCallback) {
      done()
    }

    protected onWaitingToVoid_(done: VoidCallback) {
      done()
    }

    protected onWaitingToFlowing_(done: VoidCallback) {
      done()
      this._setup()
    }

    protected onFlowingToWaiting_(done: VoidCallback) {
      done()
    }

    protected onCompleted_(done: VoidCallback) {
      done()
    }

    protected onStateChangeAborted_(reason: string) {
      //
    }
}
