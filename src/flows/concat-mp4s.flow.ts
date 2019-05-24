import { Flow } from "../core/flow";
import { VoidCallback } from "../common-types";
import { XhrSocket } from "../io-sockets/xhr.socket";
import { newProcessorWorkerShell } from "../core/processor-factory";
import { MP4DemuxProcessor } from "../processors/mp4-demux.processor";
import { ProcessorEvent, ProcessorEventData } from "../core/processor";
import { OutputSocket, SocketEvent } from "../core/socket";
import { FifoValve, wrapOutputSocketWithValve } from "../core/fifo";
import { getLogger, LoggerLevel } from "../logger";
import { PayloadDescriptor } from "../core/payload-description";

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
      let payloadDescrVideoA: PayloadDescriptor = null;
      let payloadDescrAudioA: PayloadDescriptor = null;

      const mp4Demux = newProcessorWorkerShell(MP4DemuxProcessor);

      mp4Demux.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {

        if (data.socket.payload().isVideo()) {

          fifoVideoA = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(data.socket), () => {});

          data.socket.on(SocketEvent.ANY_PACKET_TRANSFERED, () => {
            if (!payloadDescrVideoA) {
              payloadDescrVideoA = fifoVideoA.queue.peek().defaultPayloadInfo;
              log('got primary video payload description:', payloadDescrVideoA)
            }
          });

        } else if (data.socket.payload().isAudio()) {

          fifoAudioA = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(data.socket), () => {});

          data.socket.on(SocketEvent.ANY_PACKET_TRANSFERED, () => {
            if (!payloadDescrAudioA) {
              payloadDescrAudioA = fifoAudioA.queue.peek().defaultPayloadInfo;
              log('got primary audio payload description:', payloadDescrVideoA)
            }
          });

        }

      });

      xhrSocketMovA.connect(mp4Demux.in[0])
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
