import { Mp4AtomsScanResult, Mp4StreamParser } from './mp4-stream-parser';

export class Mp4StreamAdapter {
  private _bytesPushed = 0;

  private _bytesRead = 0;

  private _mp4Parser: Mp4StreamParser = new Mp4StreamParser();

  private _reader: ReadableStreamDefaultReader<Uint8Array> | null;

  private _readingDone = false;

  constructor (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    private _onData: (
      boxData: Uint8Array | null | Error,
      boxInfo?: Mp4AtomsScanResult,
      done?: boolean,
    ) => void,
    private _closingAtoms: string[] = ['moov', 'mdat']
  ) {
    this._reader = reader;
    this._consume();
  }

  close () {
    this._reader = null;
  }

  get bytesRead (): number {
    return this._bytesRead;
  }

  get bytesPushed (): number {
    return this._bytesPushed;
  }

  get closed (): boolean {
    return this._reader === null;
  }

  get done (): boolean {
    return this._readingDone;
  }

  private _consume () {
    if (!this._reader) {
      throw new Error('Stream adapter is already closed');
    }

    this._reader
      .read()
      .then((result: ReadableStreamDefaultReadResult<Uint8Array>) => {
        if (result.value) {
          const buf = result.value;
          this._bytesRead += buf.byteLength;
          this._mp4Parser.append(buf);
          const [data, boxes] = this._mp4Parser.parse(this._closingAtoms);
          if (data) {
            this._bytesPushed += data.byteLength;
            this._onData(data, boxes);
          }
        }
        if (result.done) {
          if (this._readingDone) {
            throw new Error(
              'Failed assertion on stream-reading state (duplicate done-flag in result)'
            );
          }
          this._readingDone = true;
          if (this.bytesRead !== this.bytesPushed) {
            throw new Error('Failed assertion on adapter bytes counters');
          }
          this._onData(null, null, true);
        } else {
          this._consume();
        }
      })
      .catch((err) => {
        // TODO: Call onData with done true?
        if (err instanceof Error) {
          this._onData(err);
        } else {
          this._onData(new Error(err));
        }
      });
  }
}
