export class ByteRange {
    from: number;
    to: number;
    total: number;

    /**
     * Assumes input like `"0-99"`
    rawByteRange
     */
    static fromString (rawByteRange: string) {
      if (typeof rawByteRange !== 'string') {
        throw new Error('Raw byte-range is not a string');
      }
      const parsedRawBr: number[] = rawByteRange.split('-').map((v) => Number(v));
      return new ByteRange(parsedRawBr[0], parsedRawBr[1]);
    }

    constructor (from: number = 0, to: number, total: number = NaN) {
      this.from = from;
      this.to = to;
      this.total = total;
    }

    toHttpHeaderValue (contentRange: boolean = false): string {
      if (contentRange) {
        if (isNaN(this.total)) {
          return `bytes ${this.from}-${this.to}/*`;
        } else {
          return `bytes ${this.from}-${this.to}/${this.total}`;
        }
      } else {
        return `bytes=${this.from}-${this.to}`;
      }
    }

    toString (): string {
      return JSON.stringify({
        from: this.from,
        to: this.to,
        total: this.total
      });
    }
}
