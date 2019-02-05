export type ErrorInfo = {
  code: number,
  message: string,
  nestedError?: Error,
  customData?: any,
};

/**
 * Caution: This does shallow clone. May matter if you have custom data.
 * In case you want that actually copied, take care of it yourself
 * @param errorInfo
 */
export function cloneErrorInfo(errorInfo: ErrorInfo): ErrorInfo {
  return Object.assign({}, errorInfo)
}

/**
 * Uses `cloneErrorInfo` applied to an existing object of a type extending (i.e overlaping completely with) `ErrorInfo`.
 * @param errorInfo
 */
export function assignErrorInfo<E extends ErrorInfo>(errorInfoOut: E, errorInfoIn: ErrorInfo): ErrorInfo {
  return Object.assign(errorInfoOut, errorInfoIn)
}
