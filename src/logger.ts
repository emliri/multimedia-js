// TODO: Move to Objec-TS long-term

const PREFIX_ROOT = 'mm';

const LOGGER_CONFIG_STORAGE_KEY = 'mmjs:LoggerConfig';

const DEBUG = false;

const noop = () => {};

const getPrefix = function (type: string, category: string): string {
  const prefix = `[${PREFIX_ROOT}]:[${type}]:[${category}] >`;
  return prefix;
};

const regExpEscape = function (s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

function persistConfig (config: LoggerConfig): boolean {
  if (window && !localStorage) {
    console.error('mmjs:Logger (ERROR) > Failed to persist configuration, no localStorage API found');
    return false;
  } else if (!localStorage) {
    // might happen in Worker
    return false;
  }
  try {
    localStorage.setItem(LOGGER_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('mmjs:Logger (ERROR) > Failed to persist configuration, internal error:', err);
    return false;
  }
  return true;
}

let DEFAULT_GLOBAL_LEVEL: LoggerLevel;

export type LoggerFunc = (...args: any[]) => void;

export type Logger = {
  debug: LoggerFunc
  log: LoggerFunc
  info: LoggerFunc,
  warn: LoggerFunc
  error: LoggerFunc
};

export enum LoggerLevel {
  ON = Infinity,
  DEBUG = 5,
  LOG = 4,
  INFO = 3,
  WARN = 2,
  ERROR = 1,
  OFF = 0
}

export type LoggerConfig = {
  [catMatcher: string]: LoggerLevel
};

DEFAULT_GLOBAL_LEVEL = LoggerLevel.ON;

export const defaultGlobalConfig: LoggerConfig = { '*': DEFAULT_GLOBAL_LEVEL };

export const loggerConfig: LoggerConfig = createAndGetLocalLoggerConfig();

export function createAndGetLocalLoggerConfig (): LoggerConfig {
  let config: LoggerConfig;

  const globalScope = self;

  if (globalScope.localStorage) {
    let object: string = localStorage.getItem(LOGGER_CONFIG_STORAGE_KEY) || '{}';

    try {
      config = JSON.parse(object);
    } catch (err) {
      console.warn('mmjs:Logger (WARN) > Got most likely corrupt logger config data! Running recovery routine...');
      removeLocalLoggerConfig();
      return createAndGetLocalLoggerConfig();
    }

    // persist if creating state first time
    persistConfig(config);
  } else { // fallback for workers (or no LocalStorage API support)
    config = globalScope[LOGGER_CONFIG_STORAGE_KEY] || defaultGlobalConfig;
    globalScope[LOGGER_CONFIG_STORAGE_KEY] = config;
  }

  return config;
}

export function removeLocalLoggerConfig () {
  delete self[LOGGER_CONFIG_STORAGE_KEY];
  localStorage.removeItem(LOGGER_CONFIG_STORAGE_KEY);
}

export function setLocalLoggerLevel (categoryMatcher: string, level: LoggerLevel): LoggerConfig {
  const config = createAndGetLocalLoggerConfig();
  config[categoryMatcher] = level;
  // store with changes
  persistConfig(config);
  return config;
}

export function getConfiguredLoggerLevelForCategory (
  category: string,
  defaultLevel: LoggerLevel = LoggerLevel.OFF,
  config: LoggerConfig = createAndGetLocalLoggerConfig()): LoggerLevel {
  let retLevel: LoggerLevel;

  Object.keys(config).forEach((catMatcher: string) => {
    const level: LoggerLevel = config[catMatcher];
    const parsedMatcher: string = catMatcher.split('*').map(regExpEscape).join('.*');
    const isCatMatching = (new RegExp('^' + parsedMatcher + '$')).test(category);

    if (isCatMatching && (retLevel == null || level < retLevel)) { // we are enforcing the lowest level specified by any matching category wildcard
      retLevel = level;
    }
  });
  return retLevel == null ? defaultLevel : retLevel;
}

export function checkLogLevel (level: number, catLevel: number) {
  switch (catLevel) {
  case LoggerLevel.DEBUG: return (level >= LoggerLevel.DEBUG) && console.debug;
  case LoggerLevel.LOG: return (level >= LoggerLevel.LOG) && console.log;
  case LoggerLevel.INFO: return (level >= LoggerLevel.INFO) && console.info;
  case LoggerLevel.WARN: return (level >= LoggerLevel.WARN) && console.warn;
  case LoggerLevel.ERROR: return (level >= LoggerLevel.ERROR) && console.error;
  }
}

export const getLogger = function (category: string, level: number = LoggerLevel.ON): Logger {
  level = getConfiguredLoggerLevelForCategory(category, level);

  if (DEBUG) {
    console.log(`mmjs:Logger (DEBUG mode) > Set-up category <${category}> with level ${level}`);
  }

  return {
    debug: checkLogLevel(level, LoggerLevel.DEBUG) ? console.debug.bind(console, getPrefix('d', category)) : noop,
    log: checkLogLevel(level, LoggerLevel.LOG) ? console.log.bind(console, getPrefix('l', category)) : noop,
    info: checkLogLevel(level, LoggerLevel.INFO) ? console.info.bind(console, getPrefix('i', category)) : noop,
    warn: checkLogLevel(level, LoggerLevel.WARN) ? console.warn.bind(console, getPrefix('w', category)) : noop,
    error: checkLogLevel(level, LoggerLevel.ERROR) ? console.error.bind(console, getPrefix('e', category)) : noop
  };
};

export function makeLogTimestamped (...args): string {
  let message = `[${(new Date()).toISOString()}]`;
  args.forEach((arg) => {
    message += ' ' + arg;
  });
  return message;
}
