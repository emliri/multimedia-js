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

export * as Utils from './src/common-utils';
export * as Crypto from './src/common-crypto';

export { Processor, ProcessorEvent, ProcessorEventData } from './src/core/processor';
export { InputSocket, Socket, OutputSocket, SocketDescriptor, SocketEvent } from './src/core/socket';
export { Packet } from './src/core/packet';
export { BufferSlice } from './src/core/buffer';
export { BufferProperties } from './src/core/buffer-props';
export { CommonMimeTypes, MimetypePrefix, PayloadDescriptor, PayloadDetails, PayloadCodec } from './src/core/payload-description';
export { Signal } from './src/core/signal';
export { Flow, FlowErrorType, FlowEvent, FlowState, FlowConfigFlag } from './src/core/flow';

export { ErrorCode, ErrorCodeSpace, getErrorNameByCode } from './src/core/error';

export {VoidCallback} from "./src/common-types"

export { EnvironmentVars, setEnvironmentVar, getEnvironmentVar } from './src/core/env';

export * as IoSockets from './src/io-sockets/index'
export * as Flows from './src/flows/index'

export * as Procs from './src/processors/index'
export * as ProcFactory from './src/core/processor-factory';

export {
  setLocalLoggerLevel,
  createAndGetLocalLoggerConfig as getLocalLoggerConfig,
  removeLocalLoggerConfig
} from './src/logger';

