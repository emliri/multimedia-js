import { SeekableOutputSocket, OutputSocket, SocketDescriptor } from '../core/socket';
import { Packet } from '../core/packet';

const fs = require('fs');
const path = require('path');

/**
 * @see https://nodejs.org/api/fs.html#fs_file_system_flags
 *
 * @see https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings
 *
 */
export type ReadableFileStreamOptions = {
  flags?: string
  encoding?: string
  fd?: number
  mode?: number
  autoClose?: boolean
  start?: number
  end?: number
  highWaterMark?: number
};

export class NodeFsReadSocket extends SeekableOutputSocket {
  /**
   * @see https://nodejs.org/api/stream.html#stream_class_stream_readable
   */
  private stream: any = null; // Nodejs ReadableStream
  private options: ReadableFileStreamOptions = null;
  private absFilePath: string = null;

  constructor (filePath: string, options?: ReadableFileStreamOptions) {
    super(new SocketDescriptor());

    this.options = options;
    this.absFilePath = path.resolve(filePath);

    this._seekStreamToRange(this.options.start, this.options.end);
  }

  seek (start: number = 0, end?: number): boolean {
    return this._seekStreamToRange(this.options.start, this.options.end);
  }

  private _onReadable () {
    console.log('data readable');

    // see https://nodejs.org/api/stream.html#stream_readable_readablelength

    this._drainPoll();

    // ... alternatively we could play around with 'data' listener
    // to get it fully async, but it makes everything a little more tricky
    // for no obvious benefit.
  }

  private _drainPoll () {
    let data: Buffer;
    // advantage of this approach is that we can eventually
    // try to consume a fixed buffer size if we would want to without having
    // to add any further logic here (in case the buffer size is not available
    // we would simply have to wait for the next 'readable' event).
    while (data = this.stream.read()) {
      this.transfer(Packet.fromArrayBuffer(data.buffer));
    }
  }

  private _onOpen () {
    console.log('fd open');
  }

  private _onClose () {
    console.log('fd open');
  }

  private _onEos () {
    console.log('EOS');
  }

  private _onReady () {
    console.log('readstream ready');
  }

  private _onError () {
    console.log('error');
  }

  private _seekStreamToRange (start: number = 0, end?: number): boolean {
    if (this.stream) {
      this.stream.destroy();
    }

    this.options.start = start;
    this.options.end = end;

    try {
      this.stream = fs.createReadStream(this.absFilePath, this.options);
    } catch (err) {
      console.error(err.message);
      this.stream = null;
      return false;
    }

    const readable = this.stream;
    readable.on('open', this._onOpen.bind(this));
    readable.on('close', this._onClose.bind(this));
    readable.on('ready', this._onReady.bind(this));
    readable.on('readable', this._onReadable.bind(this));
    readable.on('end', this._onEos.bind(this));
    readable.on('error', this._onError.bind(this));

    return true;
  }
}
