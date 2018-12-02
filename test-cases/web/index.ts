import { ChunkToMediaSource } from './chunk-to-media-source'
import { RemixMovieSoundtrack } from './remix-movie-soundtrack'
import { TsToMp3 } from './ts-to-mp3'
import { FFmpegBasic } from './ffmpeg-basic';
import { FFmpegFlow } from './ffmpeg-flow';

import * as mmjs from '../../index';

export {
  mmjs,

  // effective order of test-cases in loader/runner
  ChunkToMediaSource,
  RemixMovieSoundtrack,
  TsToMp3,
  FFmpegBasic,
  FFmpegFlow
}
