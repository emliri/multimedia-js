// would be nice but webpack takes looong to compile this :)

//import ffmpegMp4Toolchain from 'ffmpeg.js/ffmpeg-mp4';
/*
import ffmpegWebmToolchain from 'ffmpeg.js/ffmpeg-webm';
*/
// for now let's try to rely on a global install or some other delegation of the problem to the user by dependency injection

import { getLogger } from '../../logger';

const {debug, log, error} = getLogger('ffmpeg');

export type FFmpegToolchainExeWrapper = any; // FIXME: any as placeholder (need to create type-definitions or wrapper of ffmpeg.js API)

//export type FFmpegMEMFSFileItem = ...

export class FFmpegConverter {

  /*
  static get MP4Toolchain(): FFmpegToolchainExeWrapper {
    return ffmpegMp4Toolchain;
  }


  static get WEBMToolchain(): FFmpegToolchainBuild {
    return ffmpegWebmToolchain;
  }
  */

  constructor(public ffmpeg: FFmpegToolchainExeWrapper) {}

  runOnOneFile(fileData: Uint8Array, fileName: string, ffmpegArguments: string[]) {
    const {ffmpeg} = this;
    // Encode test video to VP8.
    const result = ffmpeg({
      MEMFS: [{name: fileName, data: fileData}],
      arguments: ffmpegArguments,
      // Ignore stdin read requests.
      stdin: function() {},
    });
    // Write out.webm to disk.
    const out = result.MEMFS[0];
    return out;
  }

  getVersion(): Promise<string> {
    let stdout = "";
    let stderr = "";
    const {ffmpeg} = this;
    return new Promise<string>((res, rej) => {
      // Print FFmpeg's version.
      ffmpeg({
        arguments: ["-version"],
        print: function(data) {
          stdout += data + "\n";
          debug (data);
        },
        printErr: function(data) {
          stderr += data + "\n";
          error(data);
        },
        onExit: function(code) {
          log("Virtual process exited with code " + code);
          if (code === 0) {
            res(stdout);
          } else {
            rej(stderr);
          }
        },
      });
    });
  }
}

