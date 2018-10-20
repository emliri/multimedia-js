/**
 *
 * @returns true on finite values, false on Infinity
 *          returns false on anything that is not convertible to a number (when not a number type), see isConvertibleToNumber
 */
export function isNumber (n: number): boolean {
  return Number.isFinite(n);
}

/**
 *
 * @returns true on: empty string, booleans, null, finite number values and +/- Infinity
 *          false on: everything else -> objects, non-empty string, undefined, NaN (obviously)
 */
export function isConvertibleToNumber (n: any): boolean {
  return !isNaN(n);
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

export function concatArrayBuffers (buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  if (!buffer1) {
    return buffer2;
  } else if (!buffer2) {
    return buffer1;
  }
  let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
}

export function forEachOwnPropKeyInObject<T> (object: Object, callback: (el: T) => void) {
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      const element = object[key];
      callback(element);
    }
  }
}

export function dispatchAsyncTask (func: () => void, timeoutSeconds: number = 0): number {
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
      let validPropsIndex = validProperties.indexOf(queryTokens[i]);
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

export const MAX_UINT_32 = 4294967296;
export const MAX_UINT_16 = 65536;

export const readUint16 = (buffer: Uint8Array, offset: number): number => {
  const val = buffer[offset] << 8 |
              buffer[offset + 1];
  return val < 0 ? MAX_UINT_16 + val : val;
}

export const readUint32 = (buffer: Uint8Array, offset: number): number => {
  const val = buffer[offset] << 24 |
              buffer[offset + 1] << 16 |
              buffer[offset + 2] << 8 |
              buffer[offset + 3];
  return val < 0 ? MAX_UINT_32 + val : val;
}

export const writeUint32 = (buffer: Uint8Array, offset: number, value: number) => {
  buffer[offset] = value >> 24;
  buffer[offset+1] = (value >> 16) & 0xff;
  buffer[offset+2] = (value >> 8) & 0xff;
  buffer[offset+3] = value & 0xff;
}

export const utf8CharsToString = (bytes: Uint8Array): string => {
  return String.fromCharCode.apply(null, bytes)
}

export const unicodeCharsToString = (hexChars: Uint16Array): string => {
  return String.fromCharCode.apply(null, hexChars)
}

export function utf8StringToBuffer(str: string): ArrayBuffer {
  var buf = new ArrayBuffer(str.length); // 2 bytes for each char
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}



