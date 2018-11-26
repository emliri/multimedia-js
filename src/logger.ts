// TODO: Move to Objec-TS long-term

const PREFIX_ROOT = 'mm';

const noop = () => {};

const getPrefix = function (type: string, category: string): string {
  const prefix = `[${PREFIX_ROOT}]:[${type}]:[${category}] >`;
  return prefix;
};

export function checkLogLevel (level: number, catLevel: number) {
  switch (catLevel) {
  case LoggerLevels.DEBUG: return (level >= LoggerLevels.DEBUG) && console.debug;
  case LoggerLevels.LOG: return (level >= LoggerLevels.LOG) && console.log;
  case LoggerLevels.INFO: return (level >= LoggerLevels.INFO) && console.info;
  case LoggerLevels.WARN: return (level >= LoggerLevels.WARN) && console.warn;
  case LoggerLevels.ERROR: return (level >= LoggerLevels.ERROR) && console.error;
  }
}

export type LoggerFunc = (...args: any[]) => void;

export type Logger = {
  debug: LoggerFunc
  log: LoggerFunc
  info: LoggerFunc,
  warn: LoggerFunc
  error: LoggerFunc
};

export enum LoggerLevels {
  ON = Infinity,
  DEBUG = 5,
  LOG = 4,
  INFO = 3,
  WARN = 2,
  ERROR = 1,
  OFF = 0
}

export const getLogger = function (category: string, level: number = LoggerLevels.ON): Logger {
  let window = self; // Needed for WebWorker compat

  return {
    debug: checkLogLevel(level, LoggerLevels.DEBUG) ? console.debug.bind(window['console'], getPrefix('d', category)) : noop,
    log: checkLogLevel(level, LoggerLevels.LOG) ? console.log.bind(window['console'], getPrefix('l', category)) : noop,
    info: checkLogLevel(level, LoggerLevels.INFO) ? console.info.bind(window['console'], getPrefix('i', category)) : noop,
    warn: checkLogLevel(level, LoggerLevels.WARN) ? console.warn.bind(window['console'], getPrefix('w', category)) : noop,
    error: checkLogLevel(level, LoggerLevels.ERROR) ? console.error.bind(window['console'], getPrefix('e', category)) : noop
  };
};

export function makeLogTimestamped (...args): string {
  let message = `[${(new Date()).toISOString()}]`;
  args.forEach((arg) => {
    message += ' ' + arg;
  });
  return message;
}
