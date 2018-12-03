import { MmjsTestCase } from "../mmjs-test-case";

import { getLogger } from "../../src/logger";
import { XhrSocket } from "../../src/io-sockets/xhr.socket";
import { WebFileDownloadSocket } from "../../src/io-sockets/web-file-download.socket";
import { FFmpegConvertProcessor } from "../../src/processors/ffmpeg-convert.processor";
import { newProcessorWorkerShell, unsafeProcessorType } from "../../src/core/processor-factory";
import { FFmpegConversionTargetInfo } from "../../src/processors/ffmpeg/ffmpeg-tool";
import { makeTemplate } from "../../src/common-utils";

const {log, error} = getLogger('ffmpeg-basic-testcase');

declare var ffmpeg: any;

export class FFmpegFlow extends MmjsTestCase {

  setup(done: () => void) {

    const inputFiles = [
      '/test-data/mp3/212438__pcfstnk__ubahn.mp3',
      '/test-data/161649__cosmicembers__birds-sing-in-woods.wav',
      '/test-data/449897__softwalls__highlights-or-messages.wav',
      '/test-data/export.wav',
      '/test-data/export.mp3'
    ];

    const xhrSocket = new XhrSocket(inputFiles[4]);

    const audioConfig: FFmpegConversionTargetInfo = {
      targetBitrateKbps: 256,
      targetCodec: 'aac',
      targetFiletypeExt: 'mp4'
    }

    const ffmpegProc = newProcessorWorkerShell(
      unsafeProcessorType(FFmpegConvertProcessor),
      [audioConfig, null],
      ['/vendor/ffmpeg.js/ffmpeg-mp4.js']
    );

    const fileDownloadSocket = new WebFileDownloadSocket(
      document.querySelector('#root'),
      'audio/mp4',
      makeTemplate("ffmpeg-output${counter}.mp4")
    );

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
