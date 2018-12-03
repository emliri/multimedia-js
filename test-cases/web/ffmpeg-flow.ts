import { MmjsTestCase } from "../mmjs-test-case";

import { getLogger } from "../../src/logger";
import { XhrSocket } from "../../src/io-sockets/xhr.socket";
import { WebFileDownloadSocket } from "../../src/io-sockets/web-file-download.socket";
import { FFmpegConvertProcessor } from "../../src/processors/ffmpeg-convert.processor";
import { newProcessorWorkerShell, unsafeProcessorType } from "../../src/core/processor-factory";
import { FFmpegConversionTargetInfo } from "../../src/processors/ffmpeg/ffmpeg-tool";

const {log, error} = getLogger('ffmpeg-basic-testcase');

declare var ffmpeg: any;

export class FFmpegFlow extends MmjsTestCase {

  setup(done: () => void) {

    const inputFile = '/test-data/mp3/212438__pcfstnk__ubahn.mp3';

    const xhrSocket = new XhrSocket(inputFile);
    const ffmpegProcArgs: FFmpegConversionTargetInfo[]  = [
      {
        targetBitrateKbps: 128,
        targetCodec: 'aac',
        targetFiletypeExt: 'mp4'
      }
    ];

    const ffmpegProc = newProcessorWorkerShell(
      unsafeProcessorType(FFmpegConvertProcessor),
      ffmpegProcArgs,
      ['/vendor/ffmpeg.js/ffmpeg-mp4.js']
    );

    const fileDownloadSocket = new WebFileDownloadSocket(document.querySelector('#root'), 'audio/mp4');

    /*
    xhrSocket.connect(InputSocket.fromFunction((p: Packet) => {
      fileDownloadSocket.transfer(p);
      return true;
    }));
    */

    xhrSocket.connect(ffmpegProc.in[0]);
    ffmpegProc.out[0].connect(fileDownloadSocket);
  }

  run() {
    throw new Error("Method not implemented.");
  }
}
