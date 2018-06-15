/*

Copyright (c) Stephan Hesse 2015 <tchakabam@gmail.com>

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

*/

import { LambdaProcessor } from './src/processors/lambda.processor';

import { MP3ParseProcessor } from './src/processors/mp3-parse.processor';
import { H264ParseProcessor } from './src/processors/h264-parse.processor';

import { MP4MuxProcessor } from './src/processors/mp4-mux.processor';
import { MP4DemuxProcessor } from './src/processors/mp4-demux.processor';

import { BroadwayProcessor } from './src/processors/broadway.processor';

import { HttpToMediaSourceTubing } from './src/tubings/http-to-media-source.tubing';

export const Processors = {
  H264ParseProcessor,
  MP3ParseProcessor,
  MP4MuxProcessor,
  MP4DemuxProcessor,
  BroadwayProcessor,
  LambdaProcessor
};

import { XhrSocket } from './src/io-sockets/xhr.socket';
import { NodeFsWriteSocket } from './src/io-sockets/node-fs-write.socket';
import { NodeFsReadSocket } from './src/io-sockets/node-fs-read.socket';

export const IoSockets = {
  XhrSocket,
  // NodeFsReadSocket,
  // NodeFsWriteSocket
}

export const Tubings = { HttpToMediaSourceTubing }
