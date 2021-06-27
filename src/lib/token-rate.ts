export class TokenRate {
  public tokens: number = 0;
  public counter: number = 0;

  private _time: number | null = 0;
  private _value: number | null = null;

  constructor (public deltaMs: number = 1000) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      throw new Error('Invalid delta-time (ms) value: ' + deltaMs);
    }
    this.reset();
  }

  reset () {
    this.tokens = 0;
    this.counter = 0;
    return this;
  }

  /**
   * @returns Tokens / second
   */
  value (): number {
    const now = Date.now();
    const elapsed = now - (this._time || 0);
    if (elapsed > this.deltaMs || this._time === null) {
      this._time = now;
      this._value = this.tokens * 1000 / elapsed;

      this.tokens = 0;
    }
    return this._value;
  }

  updateAndEval (cnt: number): number {
    return this.update(cnt).value();
  }

  addAndEval (diff: number): number {
    return this.add(diff).value();
  }

  /**
   * Update with a counter state,
   * calls `add()` with computed-back diff using internal counter-state.
   * @param count
   */
  update (count: number) {
    this.add(count - this.counter);
    this.counter = count;
    return this;
  }

  /**
   * Update incrementally (diff-sample based)
   * @param tokens
   */
  add (tokens: number) {
    this.tokens += tokens;
    return this;
  }
}
