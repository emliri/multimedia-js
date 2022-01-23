
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
