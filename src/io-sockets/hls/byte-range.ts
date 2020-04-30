export class ByteRange {

    from: number;
    to: number;
    total: number;

    /**
     * Assumes input in the form `"0-99"`
     * @param rawByteRange
     */
    static fromString(rawByteRange: string) {
      if (typeof rawByteRange !== 'string') {
        throw new Error('Raw byte-range is not a string')
      }
      const parsedRawBr: number[] = rawByteRange.split('-').map((v) => Number(v))
      return new ByteRange(parsedRawBr[0], parsedRawBr[1])
    }

    constructor(from: number, to: number, total: number = NaN) {
      this.from = from
      this.to = to
      this.total = total

      if (this.length <= 0) {
        throw new Error('Negative or zero byte-length range: ' + this.length);
      }

      if (total !== NaN && this.to > this.total) {
        throw new Error('Range end exceeds total bytes set: ' + this.to);
      }
    }

    get length() {
      return this.to - this.from;
    }

    split(parts: number = 2): ByteRange[] {
      const partSize = Math.floor(this.length / parts);
      const remainderSize = this.length % partSize;
      const newRanges: ByteRange[] = []
      for (let i = 0; i < parts; i++) {
        const from = this.from + (i * partSize);
        const to = from + partSize + ((i === parts - 1) ? remainderSize : 0);
        newRanges.push(new ByteRange(from, to));
      }
      return newRanges;
    }

    toHttpHeaderValue(contentRange: boolean = false): string {
      if (contentRange) {
        if (isNaN(this.total)) {
          return `bytes ${this.from}-${this.to}/*`
        } else {
          return `bytes ${this.from}-${this.to}/${this.total}`
        }
      } else {
        return `bytes=${this.from}-${this.to}`
      }
    }

    toString(): string {
      return JSON.stringify({
        from: this.from,
        to: this.to,
        total: this.total
      })
    }
  }
