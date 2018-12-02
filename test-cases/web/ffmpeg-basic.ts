import { MmjsTestCase } from "../mmjs-test-case";

import { FFmpegTool } from '../../src/processors/ffmpeg/ffmpeg-tool';
import { getLogger } from "../../src/logger";
import { makeGetRequest } from "../../src/common-http";

const {log, error} = getLogger('ffmpeg-basic-testcase');

declare var ffmpeg: any;

export class FFmpegBasic extends MmjsTestCase {

  setup(done: () => void) {
    const ffmpegWrapper = new FFmpegTool(ffmpeg);
    ffmpegWrapper.getVersion().then((version) => log('ffmpeg version:', version));

    const inputFile = '/test-data/mp3/212438__pcfstnk__ubahn.mp3';
    makeGetRequest(inputFile).then((data) => {
      log('got input data no of bytes:', data.byteLength);
      const outData = ffmpegWrapper.convertAudioFile(new Uint8Array(data), 'mp3', 'aac', 'mp4', 128);
      log('got output data:', outData);
    });
  }

  run() {}
}
