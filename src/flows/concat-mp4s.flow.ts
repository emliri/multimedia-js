import { Flow, FlowCompletionResultCode, FlowConfigFlag } from '../core/flow';
import { VoidCallback } from '../common-types';
import { XhrSocket } from '../io-sockets/xhr.socket';
import { newProcessorWorkerShell, unsafeCastProcessorType } from '../core/processor-factory';
import { MP4DemuxProcessor } from '../processors/mp4-demux.processor';
import { ProcessorEvent, ProcessorEventData } from '../core/processor';
import { OutputSocket, SocketEvent, InputSocket, Socket } from '../core/socket';
import { SocketFifoValve, wrapOutputSocketWithValve } from '../core/socket-fifo';
import { getLogger, LoggerLevel } from '../logger';
import { PayloadDescriptor } from '../core/payload-description';
import { MP4MuxProcessor } from '../processors/mp4-mux-mozilla.processor';
import { PacketSymbol } from '../core/packet';
import { AacTranscodeFlow } from './aac-transcode.flow';

const { debug, log } = getLogger('ConcatMp4sFlow', LoggerLevel.ON, true);

export class ConcatMp4sFlow extends Flow {
  /**
     * @param _movUrl1 First file URL
     * @param _movUrl2 Second file URL
     * @param _allowReencode defaults to true. when true will re-encode to Bs tracks to As respective audio/video configurations
     * @param _toggleConcatOrder defaults to false. if true will toggle order of concatenation (B before A, but not changing re-encode behavior of course)
     */
  constructor (
        private _movUrl1: string,
        private _movUrl2: string,
        downloadEl?: HTMLElement,
        private _toggleConcatOrder: boolean = false
  ) {
    super(
      FlowConfigFlag.WITH_APP_SOCKET | (downloadEl && FlowConfigFlag.WITH_DOWNLOAD_SOCKET),
      null,
      null,
      {
        mimeType: 'video/mp4',
        el: downloadEl,
        filenameTemplateBase: 'buffer${counter}-${Date.now()}.mp4'
      }
    );
  }

  private _setup () {
    let fifoVideoA: SocketFifoValve = null;
    let fifoAudioA: SocketFifoValve = null;

    let fifoVideoB: SocketFifoValve = null;
    let fifoAudioB: SocketFifoValve = null;

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
    const mp4Muxer = newProcessorWorkerShell(unsafeCastProcessorType(MP4MuxProcessor));

    this.addProc(mp4DemuxA)
      .addProc(mp4DemuxB)
      .addProc(mp4Muxer);

    mp4DemuxA.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
      const socket: Socket = data.socket;
      onDemuxASocketCreated(socket);
    });

    mp4DemuxB.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {
      const socket: Socket = data.socket;
      onDemuxBSocketCreated(socket);
    });

    const urlA = this._toggleConcatOrder ? this._movUrl2 : this._movUrl1;
    const urlB = this._toggleConcatOrder ? this._movUrl1 : this._movUrl2;

    const xhrSocketMovA = new XhrSocket(urlA);
    const xhrSocketMovB = new XhrSocket(urlB);

    xhrSocketMovA.connect(mp4DemuxA.in[0]);
    xhrSocketMovB.connect(mp4DemuxB.in[0]);

    this.connectWithAllExternalSockets(mp4Muxer.out[0]);

    const aacReTranscodeFlowA = new AacTranscodeFlow(256);
    const aacReTranscodeFlowB = new AacTranscodeFlow(256);

    const aacTranscodeInA = aacReTranscodeFlowA.getExternalInputSockets()[0];
    const aacTranscodeOutA = aacReTranscodeFlowA.getExternalOutputSockets()[0];

    const aacTranscodeInB = aacReTranscodeFlowB.getExternalInputSockets()[0];
    const aacTranscodeOutB = aacReTranscodeFlowB.getExternalOutputSockets()[0];

    function onDemuxASocketCreated (socket: Socket) {
      if (socket.payload().isVideo()) {
        // create video input on muxer
        if (!mp4MuxerVideoIn) {
          mp4MuxerVideoIn = mp4Muxer.createInput();
        }

        // wrap the demuxer output with a "valve" and connect it to muxer input
        fifoVideoA = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {
          // called on each q'd packet
          if (!payloadDescrVideoA) {
            payloadDescrVideoA = fifoVideoA.queue.peek().defaultPayloadInfo;
            log('got primary video payload description:', payloadDescrVideoA);
          }
        });
        fifoVideoA.connect(mp4MuxerVideoIn);

        // called on fifo queue valve drain
        // this is to replace the eos sym packets by sync ones (otherwise muxer will flush early)
        fifoVideoA.addPacketFilterPass((p) => {
          if (p.symbol === PacketSymbol.EOS) {
            p.setSymbol(PacketSymbol.SYNC);
          }
          return p;
        });

        // called on transfer to queue
        // this is to check when we have extracted a whole track
        fifoVideoA.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
          log('video A EOS received on fifo queue');
          videoAeosDroped = true;
          attemptDrainVideoFifo();
        });
      } else if (socket.payload().isAudio()) { // same as for video but with audio ... :)
        // create audio input
        if (!mp4MuxerAudioIn) {
          mp4MuxerAudioIn = mp4Muxer.createInput();
        }

        debug('demux A audio socket created');

        OutputSocket.fromUnsafe(socket).connect(aacTranscodeInA);

        {
          const socket = aacTranscodeOutA; // to not use the AAC transcoder, just kill this line

          // wrap the demuxer output with a "valve" and connect it to muxer input
          fifoAudioA = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {
            // called on each q'd packet
            if (!payloadDescrAudioA) {
              payloadDescrAudioA = fifoAudioA.queue.peek().defaultPayloadInfo;
              log('got primary audio payload description:', payloadDescrAudioA);
            }
          });
          fifoAudioA.connect(mp4MuxerAudioIn);

          // called on fifo queue valve drain
          // this is to replace the eos sym packets by sync ones (otherwise muxer will flush early)
          fifoAudioA.addPacketFilterPass((p) => {
            if (p.symbol === PacketSymbol.EOS) {
              p.setSymbol(PacketSymbol.SYNC);
            }
            return p;
          });

          // called on transfer to queue
          // this is to check when we have extracted a whole track
          fifoAudioA.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
            log('audio A EOS received on fifo queue');
            audioAeosDroped = true;
            attemptDrainAudioFifo();
          });
        }
      }
    }

    function onDemuxBSocketCreated (socket: Socket) {
      if (socket.payload().isVideo()) {
        if (!mp4MuxerVideoIn) {
          mp4MuxerVideoIn = mp4Muxer.createInput();
        }

        fifoVideoB = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {
          // called on each q'd packet
          if (!payloadDescrVideoB) {
            payloadDescrVideoB = fifoVideoB.queue.peek().defaultPayloadInfo;
            log('got secondary video payload description:', payloadDescrVideoB);
          }
        });
        fifoVideoB.connect(mp4MuxerVideoIn);

        fifoVideoB.addPacketFilterPass((p) => {
          if (p.defaultPayloadInfo && p.defaultPayloadInfo.isBitstreamHeader) {
            log('found secondary payload video bitstream header');
          }

          p.timestamp = p.timestamp +
              (p.timeScale * videoDurationA);

          return p;
        });

        fifoVideoB.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
          log('video B EOS received on fifo queue');

          videoBeosReceived = true;

          attemptDrainVideoFifo();
        });
      } else if (socket.payload().isAudio()) {
        if (!mp4MuxerAudioIn) {
          mp4MuxerAudioIn = mp4Muxer.createInput();
        }

        debug('demux B audio socket created');

        OutputSocket.fromUnsafe(socket).connect(aacTranscodeInB);

        {
          const socket = aacTranscodeOutB; // to not use the AAC transcoder, just kill this line

          fifoAudioB = wrapOutputSocketWithValve(OutputSocket.fromUnsafe(socket), () => {
            // called on each q'd packet
            if (!payloadDescrAudioB) {
              payloadDescrAudioB = fifoAudioB.queue.peek().defaultPayloadInfo;
              log('got secondary audio payload description:', payloadDescrAudioB);
            }
          });
          fifoAudioB.connect(mp4MuxerAudioIn);

          fifoAudioB.addPacketFilterPass((p) => {
            if (p.defaultPayloadInfo && p.defaultPayloadInfo.isBitstreamHeader) {
              log('found secondary payload audio bitstream header');
            }

            p.timestamp = p.timestamp +
                (p.timeScale * audioDurationA);

            return p;
          });

          fifoAudioB.queue.on(SocketEvent.EOS_PACKET_RECEIVED, () => {
            log('audio B EOS received on fifo queue');

            audioBeosReceived = true;

            attemptDrainAudioFifo();
          });
        }
      }
    }

    function attemptDrainVideoFifo () {
      if (videoAeosDroped && videoBeosReceived) {
        videoDurationA = payloadDescrVideoA.details.sequenceDurationInSeconds;
        log('video duration of primary payload (input A):', videoDurationA, 'secs');
        videoDurationB = payloadDescrVideoB.details.sequenceDurationInSeconds;
        log('video duration of secondary payload (input B):', videoDurationB, 'secs');
        payloadDescrVideoA.details.sequenceDurationInSeconds = videoDurationA + videoDurationB;

        fifoVideoA.drain();
        fifoVideoB.drain();
      }
    }

    function attemptDrainAudioFifo () {
      if (audioAeosDroped && audioBeosReceived) {
        audioDurationA = payloadDescrAudioA.details.sequenceDurationInSeconds;
        log('audio duration of primary payload (input A):', audioDurationA, 'secs');
        audioDurationB = payloadDescrAudioB.details.sequenceDurationInSeconds;
        log('audio duration of secondary payload (input B):', audioDurationB, 'secs');
        payloadDescrAudioA.details.sequenceDurationInSeconds = audioDurationA + audioDurationB;
        fifoAudioA.drain();
        fifoAudioB.drain();
      }
    }
  }

  protected onVoidToWaiting_ (done: VoidCallback) {
    done();
  }

  protected onWaitingToVoid_ (done: VoidCallback) {
    done();
  }

  protected onWaitingToFlowing_ (done: VoidCallback) {
    this._setup();
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
