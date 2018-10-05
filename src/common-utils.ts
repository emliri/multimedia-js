/**
 *
 * @param n
 * @returns true on finite values, false on Infinity
 *          returns false on anything that is not convertible to a number (when not a number type), see isConvertibleToNumber
 */
export function isNumber(n: number): boolean {
  return Number.isFinite(n);
}

/**
 *
 * @param n
 * @returns true on: empty string, booleans, null, finite number values and +/- Infinity
 *          false on: everything else -> objects, non-empty string, undefined, NaN (obviously)
 */
export function isConvertibleToNumber(n: any): boolean {
  return !isNaN(n);
}

/**
 *
 * @param n
 * @returns a finite number or +/- Infinity (if n was that value)
 * @throws error when value is not convertible to a number
 */
export function toNumber(n: any): number {
  if (isConvertibleToNumber(n)) {
    return Number(n);
  }
  throw new Error('Value does not convert to number: ' + n);
}

export function concatArrayBuffers(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  if (!buffer1) {
    return buffer2;
  } else if (!buffer2) {
    return buffer1;
  }
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
};

export function forEachOwnPropKeyInObject<T>(object: Object, callback: (el: T) => void) {
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      const element = object[key];
      callback(element);
    }
  }
}

export function dispatchAsyncTask(func: () => void, timeoutSeconds: number = 0): number {
  return <any> setTimeout(func, timeoutSeconds * 1000);
}

export function cancelAsyncTask(id: number): void {
  clearTimeout(id);
}


