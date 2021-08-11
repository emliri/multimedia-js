import { Class, ObjectConstructor } from "../common-types";
import { objectNewFromDefaultAndPartials } from "../common-utils";

export interface IWithOptions<TOptions> {
  get OptionsDefault(): TOptions;

  get options_(): TOptions;

  getOptions(): TOptions;

  setOptions(opts?: Partial<TOptions>);
}

export type MixinWithOptions<TBase, TOptions> = TBase & Class<IWithOptions<TOptions>>;

export function mixinWithOptions<
  TBase extends ObjectConstructor,
  TOptions extends Object>(Base: TBase, defaultOpts: TOptions): MixinWithOptions<TBase, TOptions> {

  return class WithOptions extends Base implements IWithOptions<TOptions> {

    get OptionsDefault(): TOptions {
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
    get options_(): TOptions {
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
      // preserves current state, then applies partial arg on top, then fills
      // in any missing properties with defaultOpts props.
      //debugger;
      this._options = objectNewFromDefaultAndPartials(defaultOpts, this._options, opts);
    }
  }
}

