import { InputSocket, SocketDescriptor } from '../core/socket';
import { Packet } from '../core/packet';

const fs = require('fs');
const path = require('path');

/**
 * @see https://nodejs.org/api/fs.html#fs_file_system_flags
 *
 * @see https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings
 *
 */
export type WritableFileStreamOptions = {
  flags?: string
  encoding?: string
  fd?: number
  mode?: number
  autoClose?: boolean
  start?: number
};

export function createBasicWritableFileStreamOptions (
  append: boolean = true,
  isBinary: boolean = true,
  startBytesOffset: number = 0,
  failIfPathExists: boolean = false): WritableFileStreamOptions {
  const options = {
    flags: append ? 'a' : 'w',
    start: startBytesOffset,
    encoding: isBinary ? 'binary' : 'utf-8' // other less common encodings may be set explicitly after options created
  };
  if (failIfPathExists) {
    options.flags += 'x';
  }
  return options;
}

/**
 *
{fs.WritableStream} ws
 */
export function createPacketHandler (ws: any): ((p: Packet) => boolean) {
  return (p: Packet) => {
    p.data.forEach((bs) => {
      ws.write(bs.getBuffer(), () => {
        console.log('buffer written to file');
      });
    });
    return true;
  };
}

export class NodeFsWriteSocket extends InputSocket {
  /**
   * @see https://nodejs.org/api/stream.html#stream_class_stream_writable
   */
  private stream: any; // Nodejs WritableStream

  constructor (filePath: string, options?: WritableFileStreamOptions) {
    const ws = fs.createWriteStream(path.resolve(filePath), options);
    super(createPacketHandler(ws), new SocketDescriptor());
    this.stream = ws;
  }
}
