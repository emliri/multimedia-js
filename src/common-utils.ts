import { VoidCallback, TwoDimArray } from './common-types';

// eslint-disable-next-line no-void
export const noop = () => void 0;

/**
 *
 * Stolen from Lodash, mainly afaiu to handle `eq(NaN, NaN) => true`
 * *Not* a "deep equal" function. See https://github.com/lodash/lodash/blob/master/eq.js
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
export function isSame(value: any, other: any) {
  return value === other || (value !== value && other !== other)
}

export function lastOfArray<T> (a: T[]): T | null {
  if (a.length === 0) {
    return null;
  }
  return a[a.length - 1];
}

export function arrayLast<T> (arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[arr.length - 1];
}

export function arrayFirst<T> (arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[0];
}

export function orZero (val: any): number {
  return val || 0;
}

export function orMax (val: any): number {
  return val || Number.MAX_VALUE;
}

export function orMin (val: any): number {
  return val || Number.MIN_VALUE;
}

export function orInfinity (val: any, neg: boolean = false): number {
  return val || (!neg ? Infinity : -Infinity);
}

export function prntprtty (val: any, indent: number = 4): string {
  return JSON.stringify(val, null, indent);
}

/**
 *
 * @param epochMs optional number/NaN or null
 * @returns First: Epoch ms diff (Date.now sourced). Results in 0 when epochMs is falsy.
 * Second: current Date.now clock source value used
 */
export function timeMillisSince (epochMs?: number | typeof NaN | null): [number, number] {
  const now = Date.now();
  return [now - (epochMs || now), now];
}

export function secsToMillis (secs: number): number {
  return secs * 1000;
}

export function millisToSecs (millis: number): number {
  return millis / 1000;
}

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

/**
 *
 * @returns true on finite values, false on Infinity
 *          returns false on anything that is not convertible to a number (when not a number type), see isConvertibleToNumber
 */
export function isNumber (n: number): boolean {
  return Number.isFinite(n);
}

export function printNumberScaledAtDecimalOrder (value: number, order: number = 1): string {
  return (value / Math.pow(10, order)).toFixed(order);
}

/**
 *
 * @returns true on: empty string, booleans, null, finite number values and +/- Infinity
 *          false on: everything else -> objects, non-empty string, undefined, NaN (obviously)
 */
export function isConvertibleToNumber (n: any): boolean {
  return !isNaN(n);
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

export function flatten2DArray<T> (a: TwoDimArray<T>): T[] {
  return [].concat(...a);
}

export function unsafeFlattenNDimArray<T> (array: any[]): T[] {
  return array.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? unsafeFlattenNDimArray(toFlatten) : toFlatten);
  }, []);
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

export function copyArrayBufferCollection (abs: ArrayBuffer[]) {
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

export function forEachOwnPropKeyInObject<T> (object: Object, callback: (el: T) => void) {
  for (const key in object) {
    if (object.hasOwnProperty(key)) { // eslint-disable-line no-prototype-builtins
      const element = object[key];
      callback(element);
    }
  }
}

export function dispatchAsyncTask (func: VoidCallback, timeoutSeconds: number = 0): number {
  return <any> setTimeout(func, timeoutSeconds * 1000);
}

export function cancelAsyncTask (id: number): void {
  clearTimeout(id);
}

export function parseOptionsFromQueryString (
  query: string = (window as any).location.search,
  validProperties: string[] = null): {[property: string]: string} {
  if (!query) {
    return {};
  }

  if (!query.startsWith('?')) {
    throw new Error('Malformed query string, should start with a `?`');
  }

  query = query.substr(1);
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

export function arrayBufferToHexdump (buffer: ArrayBuffer): string {
  return Array.prototype.map.call(new Uint8Array(buffer),
    x => ('00' + x.toString(16)) // map each by to a a string with base16
      .slice(-2))
    .join(' ');
}

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

/**
 * Copyright 2015 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export function hexToBytes (s: string): Uint8Array {
  const len = s.length >> 1;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = parseInt(s.substr(i * 2, 2), 16);
  }
  return arr;
}

export function utf8decode (str) {
  const bytes = new Uint8Array(str.length * 4);
  let b = 0;
  for (let i = 0, j = str.length; i < j; i++) {
    let code = str.charCodeAt(i);
    if (code <= 0x7f) {
      bytes[b++] = code;
      continue;
    }
    if (code >= 0xD800 && code <= 0xDBFF) {
      const codeLow = str.charCodeAt(i + 1);
      if (codeLow >= 0xDC00 && codeLow <= 0xDFFF) {
        // convert only when both high and low surrogates are present
        code = ((code & 0x3FF) << 10) + (codeLow & 0x3FF) + 0x10000;
        ++i;
      }
    }
    if ((code & 0xFFE00000) !== 0) {
      bytes[b++] = 0xF8 | ((code >>> 24) & 0x03);
      bytes[b++] = 0x80 | ((code >>> 18) & 0x3F);
      bytes[b++] = 0x80 | ((code >>> 12) & 0x3F);
      bytes[b++] = 0x80 | ((code >>> 6) & 0x3F);
      bytes[b++] = 0x80 | (code & 0x3F);
    } else if ((code & 0xFFFF0000) !== 0) {
      bytes[b++] = 0xF0 | ((code >>> 18) & 0x07);
      bytes[b++] = 0x80 | ((code >>> 12) & 0x3F);
      bytes[b++] = 0x80 | ((code >>> 6) & 0x3F);
      bytes[b++] = 0x80 | (code & 0x3F);
    } else if ((code & 0xFFFFF800) !== 0) {
      bytes[b++] = 0xE0 | ((code >>> 12) & 0x0F);
      bytes[b++] = 0x80 | ((code >>> 6) & 0x3F);
      bytes[b++] = 0x80 | (code & 0x3F);
    } else {
      bytes[b++] = 0xC0 | ((code >>> 6) & 0x1F);
      bytes[b++] = 0x80 | (code & 0x3F);
    }
  }
  return bytes.subarray(0, b);
}

const THROW_ERROR_ON_WRITE_VALUE_OVERFLOW = false;

export const MAX_UINT_32 = 4294967296;
export const MAX_INT_32 = MAX_UINT_32 / 2;
export const MIN_INT_32 = -MAX_INT_32;
export const MAX_UINT_16 = 65536;

export const readUint16 = (buffer: Uint8Array, offset: number): number => {
  const val = buffer[offset] << 8 |
              buffer[offset + 1];
  return val < 0 ? MAX_UINT_16 + val : val;
};

export const readUint32 = (buffer: Uint8Array, offset: number): number => {
  const val = buffer[offset] << 24 |
              buffer[offset + 1] << 16 |
              buffer[offset + 2] << 8 |
              buffer[offset + 3];
  return val < 0 ? MAX_UINT_32 + val : val;
};

export function writeUint32 (buffer: Uint8Array, offset: number, value: number): number {
  if (THROW_ERROR_ON_WRITE_VALUE_OVERFLOW) {
    if (value > MAX_UINT_32) {
      throw new Error('Can not write value outside range');
    }
  }
  buffer[offset] = value >> 24;
  buffer[offset + 1] = (value >> 16) & 0xff;
  buffer[offset + 2] = (value >> 8) & 0xff;
  buffer[offset + 3] = value & 0xff;
  return 4;
}

export function writeInt32 (data: Uint8Array, offset: number, value: number): number {
  if (THROW_ERROR_ON_WRITE_VALUE_OVERFLOW) {
    if (Math.abs(value) > MAX_INT_32) {
      throw new Error('Can not write value outside range');
    }
  }
  data[offset] = (value >> 24) & 255;
  data[offset + 1] = (value >> 16) & 255;
  data[offset + 2] = (value >> 8) & 255;
  data[offset + 3] = value & 255;
  return 4;
}

// TODO: writeUint16/writeInt16

export function decodeInt32 (s: string): number {
  return (s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) |
           (s.charCodeAt(2) << 8) | s.charCodeAt(3);
}

/**
 *
 * @param d
 * @param referenceDae defaults to midnight after Jan. 1, 1904
 */
export function encodeDate (d: number, referenceDae: number = -2082844800000): number {
  return ((d - referenceDae) / 1000) | 0;
}

export function encodeFloat_16_16 (f: number): number {
  return (f * 0x10000) | 0;
}

export function encodeFloat_2_30 (f: number): number {
  return (f * 0x40000000) | 0;
}

export function encodeFloat_8_8 (f: number): number {
  return (f * 0x100) | 0;
}

export function encodeLang (s: string): number {
  return ((s.charCodeAt(0) & 0x1F) << 10) | ((s.charCodeAt(1) & 0x1F) << 5) | (s.charCodeAt(2) & 0x1F);
}

export const MAX_BITMASK_WIDTH = 31; // EMCAscript runtimes use INT32 internally so if we exceed 31 width we get a negative number

export function bitMaskHasFlag (value: number, flag: number): boolean {
  return !!(value & flag);
}

export function bitMaskCombineFlags (value1: number, value2: number): number {
  return value1 | value2;
}

export function bitMaskInvertFlags (value: number, enumSize: number = MAX_BITMASK_WIDTH): number {
  let retValue = 0;
  for (let i = 0; i < enumSize; i++) {
    const maskSweepValue = (1 << i);
    if (!(value & maskSweepValue)) {
      retValue |= maskSweepValue;
    }
  }
  return retValue;
}

export function bitMaskValueOfFlagEnum (order: number): number {
  if (order < 0) {
    throw new Error('Enum order index must ordinal');
  }
  // const bitWidth: number = Math.ceil(Math.log2(enumerationMaxSize))
  if (MAX_BITMASK_WIDTH < order) {
    throw new Error(`Bitmask max-width (${MAX_BITMASK_WIDTH}) must be greater than given ordinal`);
  }
  const flagValue: number = 1 << order;
  return flagValue;
}

export function bitMaskValueOfFlagEnumRange (from: number, to: number): number {
  if (from >= to) {
    throw new Error('Range must be strictly monotonic');
  }
  if (to > MAX_BITMASK_WIDTH) {
    throw new Error('Range has to be lower than max bitwidth');
  }
  let value = 0;
  for (let i = from; i <= to; i++) {
    value |= (1 << i);
  }
  return value;
}
