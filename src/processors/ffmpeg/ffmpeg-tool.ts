// would be nice but webpack takes looong to compile this :)

// import ffmpegMp4Toolchain from 'ffmpeg.js/ffmpeg-mp4';
/*
import ffmpegWebmToolchain from 'ffmpeg.js/ffmpeg-webm';
*/
// for now let's try to rely on a global install or some other delegation of the problem to the user by dependency injection

import { getLogger, LoggerLevel } from '../../logger';
import { noop } from '../../common-utils';

const { debug, log, warn, error } = getLogger('ffmpeg-tool', LoggerLevel.ON, true);

export type FFmpegToolchainExeWrapper = any; // FIXME: any as placeholder (need to create type-definitions or wrapper of ffmpeg.js API)

export type FFmpegFileItem = {name: string, data: Uint8Array};

export type FFmpegConversionTargetInfo = {targetCodec: string, targetFiletypeExt, targetBitrateKbps: number}

// TODO: ...
export class FFmpegStdPipeBuffer {
/**
    let stdErrBytesCount = 0;
    const stderrData: number[] = [];
    const onStdErrChar = (byte: number) => {
      stdErrBytesCount++;
      stderrData.push(byte);

      //debug(`wrote ${stdErrBytesCount} bytes to stderr`);
      if (this._onStdErrPipeByte) {
        this._onStdErrPipeByte(byte, stdErrBytesCount);
      }
    }

 */
}

export class FFmpegTool {
  /*
  static get MP4Toolchain(): FFmpegToolchainExeWrapper {
    return ffmpegMp4Toolchain;
  }

  static get WEBMToolchain(): FFmpegToolchainBuild {
    return ffmpegWebmToolchain;
  }
  */

  constructor (
    public ffmpeg: FFmpegToolchainExeWrapper,
    private _onStdErrPipeByte: (newByte: number, bytesCount: number) => void = null,
    private _onStdOutPipeByte: (newByte: number, bytesCount: number) => void = null
  ) {}

  /**
   * Slightly low-level method, better use a more convenient wrapper if it can fit your purpose.
   *
   * Usage example:
   *
   *  // notice the redundant inputfile pathname information passed here, reason why is somewhere
   *  // inside ffmpeg.s
   *  const args = ['-i', 'input.mp3', '-c:a', 'aac', '-b:a', '128k', 'output.mp4'];
   *  const outData = ffmpegWrapper.runWithOneInputFile(new Uint8Array(data), 'input.mp3', args);
   *
   * @param fileData
   * @param fileName
   * @param ffmpegArguments
   */
  runWithOneInputFile (inputFile: FFmpegFileItem, ffmpegArguments: string[]): FFmpegFileItem {
    // TODO: use FFmpegStdPipeBuffer class

    let stdErrBytesCount = 0;
    const stderrData: number[] = [];
    const onStdErrChar = (byte: number) => {
      stdErrBytesCount++;
      stderrData.push(byte);

      // debug(`wrote total ${stdErrBytesCount} bytes to stderr`);

      if (this._onStdErrPipeByte) {
        this._onStdErrPipeByte(byte, stdErrBytesCount);
      }
    };

    let stdOutBytesCount = 0;
    const stdoutData: number[] = [];
    const onStdOutChar = (byte: number) => {
      stdOutBytesCount++;
      stdoutData.push(byte);

      // debug(`wrote total ${stdOutBytesCount} bytes to stdout`);

      if (this._onStdOutPipeByte) {
        this._onStdOutPipeByte(byte, stdErrBytesCount);
      }
    };

    const { ffmpeg } = this;
    let out = null;
    try {
      const ffmpegJsConfig: any = {
        MEMFS: [inputFile],
        arguments: ffmpegArguments,
        // Ignore stdin read requests
        stdin: noop,
        stdout: onStdOutChar,
        stderr: onStdErrChar
      };
      log('running ffmpeg wrapper now with config:', ffmpegJsConfig);
      const result = ffmpeg(ffmpegJsConfig);
      out = result.MEMFS[0];
    } catch (err) {
      error('Running FFmpeg conversion tool failed with an error:', err);
    }

    debug('dumping stderr temp-buffer:', String.fromCharCode(...stderrData));

    if (!out) {
      error('no output file captured (this is a ffmpeg.js issue most likely)');
    }

    return out;
  }

  /**
   * see https://www.ffmpeg.org/ffmpeg-codecs.html#Codec-Options
   * @param inputFileData
   * @param inputExtension
   * @param audioConfig
   * @param videoConfig
   * @param extraArgs
   */
  convertAVFile (
    inputFileData: Uint8Array,
    inputExtension: string,
    audioConfig: FFmpegConversionTargetInfo | null,
    videoConfig: FFmpegConversionTargetInfo | null,
    extraArgs: string[] = []): Uint8Array {
    const inputFile: FFmpegFileItem = { name: `input.${inputExtension}`, data: inputFileData };

    let outputFileExt = null;
    if (videoConfig) {
      outputFileExt = videoConfig.targetFiletypeExt;
    } else if (audioConfig) {
      outputFileExt = audioConfig.targetFiletypeExt;
    } else {
      throw new Error('both audio/video config inexistent');
    }

    const outFilename = `output.${outputFileExt}`;

    let args: string[] = ['-i', inputFile.name];

    if (audioConfig) {
      args = args.concat(['-c:a', audioConfig.targetCodec, '-b:a', `${audioConfig.targetBitrateKbps}k`]);
    }

    if (videoConfig) {
      args = args.concat(['-c:v', videoConfig.targetCodec, '-b:v', `${videoConfig.targetBitrateKbps}k`]);
    }

    args = args.concat([outFilename], extraArgs);

    log(`calling main with args: "${args.join(' ')}"`);

    const outFile = this.runWithOneInputFile(inputFile, args);
    if (!outFile) {
      warn('no output file created');
      return null;
    }
    return outFile.data;
  }

  /**
   *
   * @param inputFileData
   * @param inputExtension without dot
   * @param targetCodec ffmpeg codec identifier, defaults to 'aac'
   * @param targetFiletypeExt without dot, defaults to 'mp4'
   */
  convertAudioFile (inputFileData: Uint8Array, inputExtension: string,
    targetCodec: string = 'aac', targetFiletypeExt: string = 'mp4', targetBitrateKbps: number = 128): Uint8Array {
    const inputFile: FFmpegFileItem = { name: `input.${inputExtension}`, data: inputFileData };
    const outFilename = `output.${targetFiletypeExt}`;
    const args = ['-i', inputFile.name, '-c:a', targetCodec, '-b:a', `${targetBitrateKbps}k`, outFilename];
    const outFile = this.runWithOneInputFile(inputFile, args);
    return outFile.data;
  }

  getVersion (): Promise<string> {
    let stdout = '';
    let stderr = '';
    const { ffmpeg } = this;
    return new Promise<string>((resolve, reject) => {
      // Print FFmpeg's version
      ffmpeg({
        arguments: ['-version'],
        print: function (data) {
          stdout += data + '\n';
          debug(data);
        },
        printErr: function (data) {
          stderr += data + '\n';
          error(data);
        },
        onExit: function (code) {
          log('Virtual process exited with code ' + code);
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(stderr);
          }
        }
      });
    });
  }
}
