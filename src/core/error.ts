export type ErrorInfo = {
  dataType: ErrorDataType,
  code: ErrorCode,
  message: string,
  innerError?: ErrorInfo,
  nativeError?: Error,
  customData?: any,
};

/**
 * Caution: This does shallow clone. May matter if you have custom data.
 * In case you want that actually copied, take care of it yourself
 * @param errorInfo
 */
export function cloneErrorInfo (errorInfo: ErrorInfo): ErrorInfo {
  return Object.assign({}, errorInfo);
}

/**
 * Uses `cloneErrorInfo` applied to an existing object of a type extending (i.e overlaping completely with) `ErrorInfo`.
 * @param errorInfo
 */
export function assignErrorInfo<E extends ErrorInfo> (errorInfoOut: E, errorInfoIn: ErrorInfo): ErrorInfo {
  return Object.assign(errorInfoOut, errorInfoIn);
}

export enum ErrorCode {

  GENERIC = 0x0000,

  FLOW_GENERIC = 0x1000,
  FLOW_INTERNAL = 0x1001,

  PROC_GENERIC = 0x2000,
  PROC_BAD_FORMAT = 0x2001,
  PROC_EARLY_EOS = 0x2002
}

export enum ErrorDataType {
  FLOW = 'flow',
  PROC = 'proc'
}
