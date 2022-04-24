import { TwoDimArray, Nullable } from './common-types';

declare let importScripts: (...paths: string[]) => void;

// GENERIC FUNCTIONAL

// eslint-disable-next-line no-void
export const noop = () => void 0;

export function isDef (val: any) {
  return val !== undefined;
}

export function orNull<T> (val: T): Nullable<T> {
  return val || null;
}

export function orZero<T> (val: T): T | 0 {
  return val || 0;
}

export function orNaN<T> (val: T): T | number {
  return val || NaN;
}

export function orInfinity (val: any, neg: boolean = false): number {
  return val || (!neg ? Infinity : -Infinity);
}

export function orMax (val: any): number {
  return val || Number.MAX_VALUE;
}

export function orMin (val: any): number {
  return val || Number.MIN_VALUE;
}

export function isWorkerScope (): boolean {
  return typeof importScripts !== 'undefined';
}

// ARRAY

export function isArrayIndexRange<T>(arr: T[], index: number): boolean {
  return Number.isInteger(index)
    && index < arr.length && index >= 0;
}

export function arrayLast<T> (arr: T[]): Nullable<T> {
  if (arr.length === 0) return null;
  return arr[arr.length - 1];
}

/**
 * @returns null on empty array (therefore diffetent top arr[0] result!)
 */
export function arrayFirst<T> (arr: T[]): Nullable<T> {
  if (arr.length === 0) return null;
  return arr[0];
}

export function flatten2DArray<T> (a: TwoDimArray<T>): T[] {
  return [].concat(...a);
}

export function unsafeFlattenNDimArray<T> (array: any[]): T[] {
  return array.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? unsafeFlattenNDimArray(toFlatten) : toFlatten);
  }, []);
}

// NUMBERS

/**
 *
 * @returns true on finite i.e "rational" values (hence "Q"), false on Infinity and NaN (and any value that is not number-type of course)
 *          returns false on anything that is not convertible to a number (when not a number type), see isConvertibleToNumber
 */
export function isQNumber (n: number): boolean {
  return Number.isFinite(n);
}

export function isNotQNumber (n: number): boolean {
  return !Number.isFinite(n);
}

/**
 * Convertable to number as in `Number(x) -> ...`, see `toNumber`
 * @returns true on: empty string, booleans, null, finite number values and +/- Infinity
 *          false on: everything else -> objects, non-empty string, undefined, NaN (obviously)
 */
export function isConvertibleToNumber (n: any): boolean {
  return !Number.isNaN(n);
}

export function isInteger (n: number): boolean {
  return Number.isInteger(n);
}

export function isIntegerIEEE754 (n: number): boolean {
  return Number.isSafeInteger(n);
}

/**
 *
 * @returns a finite number or +/- Infinity (if n was that value)
 * @throws error when value is not convertible to a number
 */
export function toNumber (n: any): number {
  if (isConvertibleToNumber(n)) {
    return Number(n);
  }
  throw new Error('Value does not convert to number: ' + n);
}

// TIME

/**
 *
 * @param epochMs optional number/NaN or null
 * @returns First: Epoch-diff millis (Date.now clock-sourced). Results in 0 when epochMs is falsy. Second: current Date.now clock source value used
 */
export function timeMillisSince (epochMs?: number | null): [number, number] {
  const now = Date.now();
  return [now - (epochMs || now), now];
}

export function secsToMillis (secs: number): number {
  return secs * 1000;
}

export function millisToSecs (millis: number): number {
  return millis / 1000;
}

export function microsToSecs (millis: number): number {
  return millis / 1000000;
}

// PRINTING / SERIALIZATION

/**
 *
 * @param s template-able string value.
 * ex: template ```var s = `${myvar}` ``` is equivalent to ```var t = makeTemplate("${myvar}"); s = eval(t)```
 * sometimes it can be useful to define the form of a template without evaluating it,
 * but pass it to the component that will do that later and thus separate these two steps as shown above.
 * notice that the variables used in the prepared template can only relate to the scope(s) in which
 * the template effectively gets evaluated, not where it gets created with this function here.
 * if you want to evaluate values from one specific context to a string, but delegate the evaluation, use OOP or a closure.
 * @returns {string} value that can be passed to `eval` in order to be evaluated as a template.
 *
 */
export function makeTemplate (s: string): string {
  return `\`${s}\``;
}

export function prntprtty (val: any, indent: number = 4): string {
  return JSON.stringify(val, null, indent);
}

export const printPrettyJson = prntprtty;

export function printNumberScaledAtDecimalOrder (value: number, order: number = 1): string {
  return (value / Math.pow(10, order)).toFixed(order);
}

// OBJECTS / HASHING

/**
 * Credits & copyright: @see Lodash.defaults
 *
 * Assigns own and inherited enumerable string keyed properties of source
 * objects to the destination object for all destination properties that
 * resolve to `undefined`. Source objects are applied from left to right.
 * Once a property is set, additional values of the same property are ignored.
 *
 * **Note:** This method mutates `object`.
 *
 * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 })
 * // => { 'a': 1, 'b': 2 }
 */

export function objectApplyDefaults<T extends Object> (object: Partial<T>, ...sources: Nullable<T>[]): T {
  /** Used for built-in method references. */
  const objectProto: Partial<T> = <T> Object.prototype;
  /** Used to check objects for own properties. */
  const hasOwnProperty = objectProto.hasOwnProperty;
  object = Object(object);
  sources.forEach((source) => {
    if (source != null) {
      source = Object(source);
      for (const key in source) {
        const value = object[key];
        // write source property into target
        // when 1) target value at property-key is undefined
        // when 2) target value is equal to Object.prototype one at property-key
        //          AND this key is not any of the targets own properties
        // -> Defaults get only applied if not applied by prior source
        // i.e already present in target object properties in some way
        // or this property is one of the base Object class prototype
        if (value === undefined ||
            (isSame(value, objectProto[key]) && !hasOwnProperty.call(object, key))) {
          object[key] = source[key];
        }
      }
    }
  });
  return object as T;
}

/**
 * Slight variation on `defaults` above, just overriding any property,
 * very much like Object.assign, but with better type-declaration.
 */
export function objectAssign<T> (object: Partial<T>, ...sources: Nullable<Partial<T>>[]): Partial<T> {
  return Object.assign(object, ...sources);
  // Lodash-like implementation (using Object.assign is likely more performant)
  /*
  const objectProto: Partial<T> = <T> Object.prototype;
  object = Object(object);
  sources.forEach((source) => {
    if (source != null) {
      source = Object(source);
      for (const key in source) {
        object[key] = source[key];
      }
    }
  })
  return object as T
  */
}

/**
 * Constructs a new instance (flat clone) of a T extends Object
 * with a list of Partial<T> sources applied iteratively from left to right (like with
 * `Object.assign`), and then applies the defaults object which
 * guarantees the object to be of complete T type, without overwriting the
 * given source properties (see `objectApplyDefaults`).
 */
export function objectNewFromDefaultAndPartials<T extends Object> (defaults: T, ...sources: Nullable<Partial<T>>[]): T {
  return objectApplyDefaults(objectAssign({}, ...sources), defaults);
}

/**
 *
 * Credits & copyright: @see Lodash.eq
 *
 * *Not* a "deep equal" function. See https://github.com/lodash/lodash/blob/master/eq.js
 *
 * The MIT License
 * Copyright JS Foundation and other contributors <https://js.foundation/>
 * Based on Underscore.js, copyright Jeremy Ashkenas,
 * DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>
 *
 * --
 *
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * const object = { 'a': 1 }
 * const other = { 'a': 1 }
 *
 * eq(object, object)
 * // => true
 *
 * eq(object, other)
 * // => false
 *
 * eq('a', 'a')
 * // => true
 *
 * eq('a', Object('a'))
 * // => false
 *
 * eq(NaN, NaN)
 * // => true
 */
export function isSame (value: any, other: any) {
  // eslint-disable-next-line no-self-compare
  return value === other || (value !== value && other !== other);
}

export function forEachOwnPropKeyInObject<T> (object: Object, callback: (el: T) => void) {
  for (const key in object) {
    if (object.hasOwnProperty(key)) { // eslint-disable-line no-prototype-builtins
      const element = object[key];
      callback(element);
    }
  }
}

export function synthesizeError (err: Error): Error {
  return {
    message: err.message,
    name: err.name,
    stack: err.stack
  };
}

// MEMORY

export function isTypedArraySharingBuffer (a: Uint8Array | Float32Array): boolean {
  return a.byteLength !== a.buffer.byteLength;
}

export function cloneTypedArray (a: Uint8Array | Float32Array): Uint8Array {
  return new Uint8Array(a);
}

// TODO: allocation methods
// TODO: allow using "fast but unsafe" allocation methods in V8/Nodejs via Buffer.allocUnsafe

/**
 * Copies source data into a previously allocated destination buffer (see memcpy)
 */
export function copyArrayBuffer (
  src: ArrayBuffer, dest: ArrayBuffer,
  length: number = src.byteLength,
  srcOffset: number = 0, destOffset: number = 0) {
  if (srcOffset + length > src.byteLength) {
    throw new Error(`Source buffer is too small for copy target of ${length} bytes at offset ${srcOffset}`);
  }

  if (destOffset + length > dest.byteLength) {
    throw new Error(`Destination buffer is too small for copy target of ${length} bytes to offset at ${destOffset}`);
  }

  const destView = new Uint8Array(dest);
  const srcView = new Uint8Array(src, srcOffset, length);
  destView.set(srcView, destOffset);
}

/**
 * Iterate over copyArrayBuffer with array of ArrayBuffer as input, offset on each pass is shifted so
 * that the buffers content are concatenated in the destination. If destination size is too low
 * `copyArrayBuffer` (i.e this function) will throw an error.
 * @param src
 * @param dest
 */
export function copyArrayBuffers (src: ArrayBuffer[], dest: ArrayBuffer) {
  for (let i = 0; i < src.length; i++) {
    copyArrayBuffer(src[i], dest, src[i].byteLength, 0, i === 0 ? 0 : src[i - 1].byteLength);
  }
}

/**
 * Copies all data from one buffer into a new one, optionnally with offset and size arguments
 * @param buffer
 * @param offset
 * @param size
 */
export function copyToNewArrayBuffer (buffer: ArrayBuffer, offset: number = 0, size?: number): ArrayBuffer {
  if (offset >= buffer.byteLength || offset + size > buffer.byteLength) {
    throw new Error(`Offset or size are out of array-buffer bounds: ${offset}/${size}, but byte-length is ${buffer.byteLength}`);
  }
  /**
   * The slice() method returns a shallow copy of a portion of an array
   * into a new array object selected from begin to end (end not included).
   * The original array will not be modified.
   */
  return buffer.slice(offset, offset + size);
}

export function copyArrayBufferList (abs: ArrayBuffer[]): ArrayBuffer[] {
  return abs.map((ab) => copyToNewArrayBuffer(ab));
}

/**
 * Concatenates two existing buffers into a newly allocated third one
 * @param buffer1
 * @param buffer2
 */
export function concatArrayBuffers (buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  if (!buffer1) {
    return buffer2;
  } else if (!buffer2) {
    return buffer1;
  }
  const newBuffer = new ArrayBuffer(buffer1.byteLength + buffer2.byteLength);
  const view = new Uint8Array(newBuffer);
  view.set(new Uint8Array(buffer1), 0);
  view.set(new Uint8Array(buffer2), buffer1.byteLength);
  return newBuffer;
}

/**
 * Concatenate the data slices from two ArrayBufferView objects
 * @param typedArray1
 * @param typedArray2
 * @returns A new ArrayBuffer containing the concatenated data from both view windows in the specific order
 */
export function concatTypedArraySlice (typedArray1: ArrayBufferView, typedArray2: ArrayBufferView): ArrayBuffer {
  const newBuffer = new ArrayBuffer(typedArray1.byteLength + typedArray2.byteLength);
  copyArrayBuffer(typedArray1.buffer, newBuffer, typedArray1.byteLength, typedArray1.byteOffset, 0);
  copyArrayBuffer(typedArray2.buffer, newBuffer, typedArray2.byteLength, typedArray2.byteOffset, typedArray1.byteLength);
  return newBuffer;
}

/**
 * Copies only the window that the view points to into a new buffer
 * @param typedArray
 * @returns A newly allocated ArrayBuffer
 */
export function copyTypedArraySlice (typedArray: ArrayBufferView): ArrayBuffer {
  return copyToNewArrayBuffer(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
}

export function writeTypedArraySlice (typedArray: ArrayBufferView, dest: ArrayBuffer, offset?: number) {
  copyArrayBuffer(typedArray.buffer, dest, typedArray.byteLength, typedArray.byteOffset, offset);
}

export function concatArrays<T> (arg0: T[], ...args: T[][]): T[] {
  return Array.prototype.concat.apply(arg0, args);
}

export function arrayBufferToHexdump (buffer: ArrayBuffer): string {
  return Array.prototype.map.call(new Uint8Array(buffer),
    x => ('00' + x.toString(16)) // map each by to a a string with base16
      .slice(-2))
    .join(' ');
}

// STRINGS

export const utf8CharsToString = (bytes: Uint8Array): string => {
  return String.fromCharCode.apply(null, bytes);
};

export const unicodeCharsToString = (hexChars: Uint16Array): string => {
  return String.fromCharCode.apply(null, hexChars);
};

export function utf8StringToBuffer (str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length); // 2 bytes for each char
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// BROWSER

export function parseOptionsFromQueryString (
  query: string = (window as any).location.search,
  validProperties: string[] = null): {[property: string]: string} {
  if (!query) {
    return {};
  }

  if (!query.startsWith('?')) {
    throw new Error('Malformed query string, should start with a `?`');
  }

  query = query.substring(1);
  const queryTokens = query.split(/&|=/);

  if (queryTokens.length % 2 !== 0) {
    throw new Error('Invalid query string in URL, uneven amount of tokens');
  }

  const options = {};

  let i = 0;
  while (i <= queryTokens.length) {
    if (validProperties) {
      const validPropsIndex = validProperties.indexOf(queryTokens[i]);
      if (validPropsIndex >= 0) {
        options[validProperties[validPropsIndex]] = queryTokens[i + 1];
      }
    } else if (queryTokens[i]) {
      options[queryTokens[i]] = queryTokens[i + 1];
    }
    i = i + 2;
  }

  return options;
}
