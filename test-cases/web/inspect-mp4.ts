import { MmjsTestCase } from "../mmjs-test-case";
import { MP4DemuxProcessor } from "../../src/processors/mp4-demux.processor";
import { newProcessorWorkerShell } from "../../src/core/processor-factory";
import { XhrSocket } from "../../src/io-sockets/xhr.socket";
import { ProcessorEvent, ProcessorEventData } from "../../src/core/processor";
import { H264ParseProcessor } from "../../src/processors/h264-parse.processor";
import { OutputSocket } from "../../src/core/socket";

export class InspectMp4 extends MmjsTestCase {

  setup(done: () => void) {

    done();

  }

  run() {

    let h264Parse;

    const mp4Demux = newProcessorWorkerShell(MP4DemuxProcessor);
    mp4Demux.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {

      if (data.socket.payload().isVideo()) {
        h264Parse = newProcessorWorkerShell(H264ParseProcessor);
        OutputSocket.fromUnsafe(data.socket).connect(h264Parse.in[0])
      }

    });

    const xhrSocket: XhrSocket = new XhrSocket('/test-data/mp4/ffmpeg-concat-out.mp4');

    xhrSocket.connect(mp4Demux.createInput())

  }

}
