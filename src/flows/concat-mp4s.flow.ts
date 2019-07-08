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
import { MP4MuxProcessor } from "../processors/mp4-mux-mozilla.processor";
import { PacketSymbol } from "../core/packet";
import { WebFileDownloadSocket } from "../io-sockets/web-file-download.socket";
import { makeTemplate } from "../common-utils";

const { log } = getLogger("ConcatMp4sFlow", LoggerLevel.ON, true);

export class ConcatMp4sFlow extends Flow {

    /**
     * @param _movUrlA First file URL
     * @param _movUrlB Second file URL
     * @param _allowReencode defaults to true. when true will re-encode to Bs tracks to As respective audio/video configurations
     * @param _toggleConcatOrder defaults to false. if true will toggle order of concatenation (B before A, but not changing re-encode behavior of course)
     */
    constructor(
        private _movUrlA: string,
        private _movUrlB:  string,
        private _toggleConcatOrder: boolean = false
    ) {
        super();
    }

    private _setup() {

      let fifoVideoA: FifoValve = null;
      let fifoAudioA: FifoValve = null;

      let fifoVideoB: FifoValve = null;
      let fifoAudioB: FifoValve = null;

      let mp4MuxerVideoIn: InputSocket = null;
      let mp4MuxerAudioIn: InputSocket = null;

      let payloadDescrVideoA: PayloadDescriptor = null;
      let payloadDescrAudioA: PayloadDescriptor = null;

      let payloadDescrVideoB: PayloadDescriptor = null;
      let payloadDescrAudioB: PayloadDescriptor = null;

      let videoDurationA: number;
      let videoDurationB: number;

      let audioDurationA: number;
      let audioDurationB: number;

      let videoBeosReceived = false;
      let videoAeosDroped = false;

      let audioBeosReceived = false;
      let audioAeosDroped = false;

      const mp4DemuxA = newProcessorWorkerShell(MP4DemuxProcessor);
      const mp4DemuxB = newProcessorWorkerShell(MP4DemuxProcessor);

      const mp4Muxer = newProcessorWorkerShell(MP4MuxProcessor);

      mp4DemuxA.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
        const socket: Socket = data.socket;
        onDemuxASocketCreated(socket);
      });

      mp4DemuxB.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
        const socket: Socket = data.socket;
        onDemuxBSocketCreated(socket);
      });

      const xhrSocketMovA = new XhrSocket(this._movUrlA);
      const xhrSocketMovB = new XhrSocket(this._movUrlB);

      xhrSocketMovA.connect(mp4DemuxA.in[0])
      xhrSocketMovB.connect(mp4DemuxB.in[0])

      mp4Muxer.out[0].connect(
        new WebFileDownloadSocket(null, 'video/mp4', makeTemplate('buffer${counter}-${Date.now()}.mp4'))
      )

      function onDemuxASocketCreated(socket: Socket) {

        if (socket.payload().isVideo()) {

          if (!mp4MuxerVideoIn) {
            mp4MuxerVideoIn = mp4Muxer.createInput();
          }

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

          if (!mp4MuxerAudioIn) {
            mp4MuxerAudioIn = mp4Muxer.createInput();
          }

          fifoAudioA = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {});
          fifoAudioA.connect(mp4MuxerAudioIn)

          fifoAudioA.addPacketFilterPass((p) => {

            if (p.symbol === PacketSymbol.EOS) {
              p.symbol = PacketSymbol.SYNC;

              audioAeosDroped = true;

              attemptDrainAudioBFifo()

            }
            return p;

          });

          fifoAudioA.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
            log('audio A EOS received on fifo queue')

            fifoAudioA.drain();
          });

          // could move that into valve CB ?
          socket.on(SocketEvent.ANY_PACKET_TRANSFERRED, () => {

            if (!payloadDescrAudioA) {
              payloadDescrAudioA = fifoAudioA.queue.peek().defaultPayloadInfo;
              log('got primary audio payload description:', payloadDescrAudioA)
            }

          });

        }
      }

      function onDemuxBSocketCreated(socket: Socket) {
        if (socket.payload().isVideo()) {

          if (!mp4MuxerVideoIn) {
            mp4MuxerVideoIn = mp4Muxer.createInput();
          }

          fifoVideoB = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {});
          fifoVideoB.connect(mp4MuxerVideoIn)

          fifoVideoB.addPacketFilterPass((p) => {

            if (p.defaultPayloadInfo && p.defaultPayloadInfo.isBitstreamHeader) {
              log('found secondary payload video bitstream header')
            }

            p.timestamp = p.timestamp
              + (p.getTimescale() * videoDurationA)

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

          if (!mp4MuxerAudioIn) {
            mp4MuxerAudioIn = mp4Muxer.createInput();
          }

          fifoAudioB = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {});
          fifoAudioB.connect(mp4MuxerAudioIn)

          fifoAudioB.addPacketFilterPass((p) => {

            if (p.defaultPayloadInfo && p.defaultPayloadInfo.isBitstreamHeader) {
              log('found secondary payload audio bitstream header')
            }

            p.timestamp = p.timestamp
              + (p.getTimescale() * audioDurationA)

            return p;
          })

          fifoAudioB.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
            log('audio B EOS received on fifo queue')

            audioBeosReceived = true;

            attemptDrainAudioBFifo()

          });

          // could move that into valve CB ?
          socket.on(SocketEvent.ANY_PACKET_TRANSFERRED, () => {

            if (!payloadDescrAudioB) {
              payloadDescrAudioB = fifoAudioB.queue.peek().defaultPayloadInfo;
              log('got secondary audio payload description:', payloadDescrAudioB)
            }

          });
        }
      }

      function attemptDrainVideoBFifo() {

        if (videoAeosDroped && videoBeosReceived) {
          videoDurationA = payloadDescrVideoA.details.sequenceDurationInSeconds;
          log('video duration of primary payload (input A):', videoDurationA, 'secs')
          videoDurationB = payloadDescrVideoB.details.sequenceDurationInSeconds;
          log('video duration of secondary payload (input B):', videoDurationB, 'secs')
          payloadDescrVideoA.details.sequenceDurationInSeconds = videoDurationA + videoDurationB;
          fifoVideoB.drain();
        }

      }

      function attemptDrainAudioBFifo() {

        if (audioAeosDroped && audioBeosReceived) {
          audioDurationA = payloadDescrAudioA.details.sequenceDurationInSeconds;
          log('audio duration of primary payload (input A):', audioDurationA, 'secs')
          audioDurationB = payloadDescrAudioB.details.sequenceDurationInSeconds;
          log('audio duration of secondary payload (input B):', audioDurationB, 'secs')
          payloadDescrAudioA.details.sequenceDurationInSeconds = audioDurationA + audioDurationB;
          fifoAudioB.drain();
        }

      }

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
