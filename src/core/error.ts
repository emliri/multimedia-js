export type ErrorInfo = {
  space: ErrorCodeSpace,
  code: ErrorCode,
  message: string,
  innerError?: ErrorInfo,
  nativeError?: Error,
  customData?: any,
};

export type ErrorInfoSpace<T extends ErrorCodeSpace> = ErrorInfo & {
  space: T
}

/**
 * Caution: This does a (recursive) shallow clone. May matter if you have custom data.
 * In case you want that actually copied, take care of it yourself
 * @param errorInfo
 */
export function cloneErrorInfo (errorInfo: ErrorInfo,
  synthesizeNativeError: boolean = false,
  onlyGenericProps: boolean = false,
  withCustomData: boolean = true): ErrorInfo {
  let clone: ErrorInfo;
  if (onlyGenericProps) {
    clone = {
      space: errorInfo.space,
      code: errorInfo.code,
      message: errorInfo.message,
      innerError: errorInfo.innerError,
      nativeError: errorInfo.nativeError,
      customData: withCustomData ? errorInfo.customData : null
    }
  } else {
    clone = assignErrorInfo({}, errorInfo);
  }
  if (synthesizeNativeError && clone.nativeError) {
    const { message, stack, name } = clone.nativeError;
    clone.nativeError = {
      message,
      stack,
      name
    };
  }
  if (clone.innerError) {
    clone.innerError = cloneErrorInfo(clone.innerError,
      synthesizeNativeError, onlyGenericProps, withCustomData);
  }
  return clone;
}

export function cloneErrorInfoSafe(errorInfo: ErrorInfo): ErrorInfo {
  return cloneErrorInfo(errorInfo, true, true, false);
}

/**
 * Uses `cloneErrorInfo` applied to an existing object of a type extending (i.e overlaping completely with) `ErrorInfo`.
 * @param errorInfo
 */
export function assignErrorInfo<E extends ErrorInfo> (errorInfoOut: Partial<E>, errorInfoIn: ErrorInfo): ErrorInfo {
  return Object.assign(errorInfoOut, errorInfoIn);
}

export enum ErrorCodeSpace {
  NONE = 0,
  FLOW = 1,
  PROC = 2
}

// allows for 99 positions in total for each error space, increase at will
// "i got 99 errors but a space aint' one" ;P
const ERROR_NUM_PER_SPACE = 99;
// set this to number of digits of ERROR_NUM_PER_SPACE (or compute with log)
const ERROR_CODE_SPACE_WIDTH = Math.ceil(Math.log10(ERROR_NUM_PER_SPACE));
// this should result to a power of 10 so that our error codes are properly "prefixed" into the decimal system
const ERROR_CODE_SPACE_SCALE = Math.pow(10, ERROR_CODE_SPACE_WIDTH);

function getErrorCodeValue (space: ErrorCodeSpace, position: number): number {
  return ERROR_CODE_SPACE_SCALE * space + position;
}

export function isErrorCodeSpace (errCode: ErrorCode, space: ErrorCodeSpace): boolean {
  return (space * ERROR_CODE_SPACE_SCALE <= errCode) &&
    ((space + 1) * ERROR_CODE_SPACE_SCALE > errCode);
}

export enum ErrorCode {
  GENERIC = getErrorCodeValue(ErrorCodeSpace.NONE, 0),

  FLOW_GENERIC = getErrorCodeValue(ErrorCodeSpace.FLOW, 0),
  FLOW_INTERNAL = getErrorCodeValue(ErrorCodeSpace.FLOW, 1),

  PROC_GENERIC = getErrorCodeValue(ErrorCodeSpace.PROC, 0),
  PROC_BAD_FORMAT = getErrorCodeValue(ErrorCodeSpace.PROC, 1),
  PROC_EARLY_EOS = getErrorCodeValue(ErrorCodeSpace.PROC, 2),
  PROC_INTERNAL = getErrorCodeValue(ErrorCodeSpace.PROC, 3)
}

export function getErrorNameByCode (errCode: ErrorCode): string {
  return ErrorCode[errCode];
}

export function getErrorSpaceByCode (errCode: ErrorCode): ErrorCodeSpace {
  // "bit-mask for decimals"
  const space = Math.round(errCode / ERROR_CODE_SPACE_SCALE);
  // double-reverse-look-up just to be sure we get an actual value
  const errorCodeSpace = ErrorCodeSpace[ErrorCodeSpace[space]];
  if (errorCodeSpace === undefined) {
    throw new Error('No errorcode-space found for: ' + errCode);
  }
  return errorCodeSpace;
}
