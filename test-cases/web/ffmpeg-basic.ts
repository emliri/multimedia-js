import { MmjsTestCase } from "../mmjs-test-case";

import { FFmpegConverter } from '../../src/processors/ffmpeg/ffmpeg';
import { getLogger } from "../../src/logger";

const {log, error} = getLogger('ffmpeg-basic-testcase');

declare var ffmpeg: any;

export class FFmpegBasic extends MmjsTestCase {

  setup(done: () => void) {
    const ffmpegWrapper = new FFmpegConverter(ffmpeg);

    ffmpegWrapper.getVersion().then((version) => log('ffmpeg version:', version));
  }

  run() {}
}
