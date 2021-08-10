import { Constructor } from "../common-types";

export interface IWithOptions {

}

export function mixinWithOptions<
  TBase extends Constructor,
  TOptions extends Object>(Base: TBase, defaultOpts: TOptions) {

  return class WithOptions extends Base {

    static get OptionsDefault(): TOptions {
      return defaultOpts;
    }

    private _options: TOptions;

    constructor(...args: any[]) {
      super(args);
      this.setOptions();
    }

    /**
     * Access to *internal* options reference,
     * CAUTION when passing on: this is not a copy,
     * mutations affect the internal state of
     * any sub-classing/mixing-in instance.
     * Should *hence* only be used over get/setOptions for
     * specific performance-scaling optimizations,
     * when you know how/why to do this.
     */
    protected get options_() {
      return this._options;
    }

    /**
     *
     * @returns options (mutable/copy)
     */
    getOptions(): TOptions {
      return Object.assign({}, this._options);
    }

    /**
     *
     * Optional param: Accepts undefined/falsy parameter, in which case the default-options
     * as defined by the mixin-function are used.
     *
     * Anything passed in is guaranteed not to be mutated,
     * and the reference ownership is never transferred,
     * the internal object being overriden by property with
     * the values of the param.
     * @param opts
     */
    setOptions(opts: Partial<TOptions> = defaultOpts) {
      this._options = Object.assign({}, this._options, opts);
      this._onSetOptions(opts);
    }

    protected _onSetOptions(partialSetOpts: Partial<TOptions>) {}
  }
}

