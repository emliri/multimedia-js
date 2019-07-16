import { MmjsTestCase } from "../mmjs-test-case";
import { MP4DemuxProcessor } from "../../src/processors/mp4-demux.processor";
import { newProcessorWorkerShell } from "../../src/core/processor-factory";
import { XhrSocket } from "../../src/io-sockets/xhr.socket";
import { ProcessorEvent, ProcessorEventData } from "../../src/core/processor";
import { H264ParseProcessor } from "../../src/processors/h264-parse.processor";
import { OutputSocket } from "../../src/core/socket";
import { AACParseProcessor } from "../../src/processors/aac-parse.processor";


const ENABLE_AUDIO = true;
const ENABLE_VIDEO = false;

export class InspectMp4 extends MmjsTestCase {

  setup(done: () => void) {

    done();

  }

  run() {

    let h264Parse;
    let aacParse;

    const mp4Demux = newProcessorWorkerShell(MP4DemuxProcessor);
    mp4Demux.on(ProcessorEvent.OUTPUT_SOCKET_CREATED, (data: ProcessorEventData) => {

      if (ENABLE_VIDEO && data.socket.payload().isVideo()) {
        h264Parse = newProcessorWorkerShell(H264ParseProcessor);
        OutputSocket.fromUnsafe(data.socket).connect(h264Parse.in[0])
      }

      else if (ENABLE_AUDIO && data.socket.payload().isAudio()) {
        aacParse = newProcessorWorkerShell(AACParseProcessor);
        OutputSocket.fromUnsafe(data.socket).connect(aacParse.in[0])
      }

    });

    const xhrSocket: XhrSocket = new XhrSocket(
      '/test-data/mp4/SampleVideo_720x480_10mb.mp4',
      //'/test-data/mp4/SampleVideo_1280x720_5mb.mp4'
      //'/test-data/mp4/buffer0-1562764964156.mp4',
      //'/test-data/mp4/180312_unicorn_hütte2_s.mp4',
      //'/test-data/mp4/01_Closing_campaign_4k.mp4',
      //'/test-data/mp4/ffmpeg-concat-out.mp4',
      //'/test-data/mp4/v-0576p-1400k-libx264.mp4'
      //'/test-data/mp4/180312_unicorn_hütte2_s.mp4'
    );

    xhrSocket.connect(mp4Demux.createInput())

  }

}
