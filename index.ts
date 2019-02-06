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
import { FFmpegConvertProcessor } from './src/processors/ffmpeg-convert.processor';

import { MP4MuxProcessor } from './src/processors/mp4-mux-mozilla.processor';
import { MP4MuxHlsjsProcessor } from './src/processors/mp4-mux-hlsjs.processor';
import { MP4DemuxProcessor } from './src/processors/mp4-demux.processor';
import { MPEGTSDemuxProcessor } from './src/processors/mpeg-ts-demux.processor';

import { BroadwayProcessor } from './src/processors/broadway.processor';

import { HttpToMediaSourceFlow } from './src/flows/http-to-media-source.flow';
import { CombineMp4sToMovFlow } from './src/flows/combine-mp4s-to-mov.flow';

import * as Utils from './src/common-utils';
import * as Crypto from './src/common-crypto';

import { XhrSocket } from './src/io-sockets/xhr.socket';

// TODO: use node-externals in webpack config
import { NodeFsWriteSocket } from './src/io-sockets/node-fs-write.socket';
import { NodeFsReadSocket } from './src/io-sockets/node-fs-read.socket';

import { Processor, ProcessorEvent } from './src/core/processor';
import { InputSocket, Socket, OutputSocket, SocketDescriptor, SocketEvent } from './src/core/socket';
import { Packet } from './src/core/packet';
import { BufferSlice } from './src/core/buffer';
import { BufferProperties } from './src/core/buffer-props';
import { CommonMimeTypes, MimetypePrefix, PayloadDescriptor, PayloadDetails } from './src/core/payload-description';
import { Signal } from './src/core/signal';
import { Flow, FlowErrorType, FlowEvent, FlowState } from './src/core/flow';

import { WebFileChooserSocket } from './src/io-sockets/web-file-chooser.socket';
import { HTML5MediaSourceBufferSocket } from './src/io-sockets/html5-media-source-buffer.socket';
import { WebFileDownloadSocket } from './src/io-sockets/web-file-download.socket';

export const Common = {
  Utils,
  Crypto,
  MimeTypes: CommonMimeTypes,
  MimetypePrefix
};

export const Core = {
  Processor,
  ProcessorEvent,
  Socket,
  SocketEvent,
  SocketDescriptor,
  InputSocket,
  OutputSocket,
  Packet,
  BufferSlice,
  BufferProperties,
  PayloadDescriptor,
  PayloadDetails,
  Signal,
  Flow, FlowErrorType, FlowEvent, FlowState
}

export const Processors = {
  H264ParseProcessor,
  MP3ParseProcessor,
  MP4MuxProcessor,
  MP4MuxHlsjsProcessor,
  MP4DemuxProcessor,
  MPEGTSDemuxProcessor,
  BroadwayProcessor,
  LambdaProcessor,
  FFmpegConvertProcessor
};

export const IoSockets = {
  XhrSocket,
  WebFileChooserSocket,
  WebFileDownloadSocket,
  HTML5MediaSourceBufferSocket,
  // NodeFsReadSocket,
  // NodeFsWriteSocket
};

export const Flows = {
  HttpToMediaSourceFlow,
  CombineMp4sToMovFlow
};

export { EnvironmentVars, setEnvironmentVar, getEnvironmentVar } from './src/core/env';

export {setLocalLoggerLevel, createAndGetLocalLoggerConfig as getLocalLoggerConfig, removeLocalLoggerConfig} from './src/logger';


