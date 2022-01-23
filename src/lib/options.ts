import { Class, ObjectConstructor } from '../common-types';
import { objectNewFromDefaultAndPartials } from '../common-utils';

export interface IWithOptions<TOptions> {
  get OptionsDefault(): TOptions;

  get options_(): TOptions;

  getOptions(): TOptions;

  setOptions(opts?: Partial<TOptions>): TOptions;
}

export type MixinWithOptions<TBase, TOptions> = TBase & Class<IWithOptions<TOptions>>;

export function mixinWithOptions<
  TBase extends ObjectConstructor,
  TOptions extends Object> (Base: TBase, defaultOpts: TOptions): MixinWithOptions<TBase, TOptions> {
  return class WithOptions extends Base implements IWithOptions<TOptions> {
    get OptionsDefault (): TOptions {
      return defaultOpts;
    }

    private _options: TOptions;

    constructor (...args: any[]) {
      super(args);
      this.setOptions();
    }

    /**
     * Access to *internal* TOptions object-ref.
     *
     * Use over get/setOptions for
     * specific performance-scaling optimizations,
     * when you know how/why to do this.
     *
     * Otherwise, use get/setOptions!
     *
     * CAUTION when passing on: this is not a copy:
     * mutations affect the internal state of instance.
     *
     * MOREOVER, any call to `setOptions` will *replace/invalidate*
     * this internal reference, so r/w-ops to a priorly obtained
     * object-ref via this getter would not refer anymore to current state!
     * And also lead to memory-leaks in principle.
     *
     * THEREFORE, this is *only* fully _safe_ to be used from within
     * the subclass impl, and only as local ref, but not to be transferred/shared
     * ownership elsewhere, or store the in any way.
     *
     */
    get options_ (): TOptions {
      return this._options;
    }

    /**
     *
     * @returns options (mutable/copy)
     */
    getOptions (): TOptions {
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
    setOptions (opts: Partial<TOptions> = defaultOpts) {
      // preserves current state, then applies partial arg on top, then fills
      // in any missing properties with defaultOpts props.
      // returns a newly created TOptions object every time.
      this._options = objectNewFromDefaultAndPartials(defaultOpts, this._options, opts);
      return this._options;
    }
  };
}
