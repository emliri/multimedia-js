import 'should';

import { getConfiguredLoggerLevelForCategory, LoggerLevel, Logger, getLogger } from './logger';

describe('Logger', () => {
  const originalConsole = global.console;
  const originalLocalStorage: Storage = (global as any).localStorage;

  beforeEach(() => {
    global.console = Object.assign(global.console, {
      debug: jest.fn(),
      error: jest.fn()
    })
  })

  afterEach(() => {
    global.console = originalConsole;
    (global as any).localStorage = originalLocalStorage;
  })

  describe('default log level', () => {
    let logger: Logger

    beforeEach(() => {
      logger = getLogger('MyCategory')
    })

    it('should log all messages (default log level is ON)', () => {
      logger.debug('foo');
      logger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(1);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(1);
    });
  })

  describe('configuring default log level to OFF', () => {
    let logger: Logger

    beforeEach(() => {
      (global as any).localStorage = {
        getItem () {
          return '{"*": 0}'
        },
        setItem () {
        }
      }
      logger = getLogger('MyCategory')
    })

    it('should not log anything', () => {
      logger.debug('foo');
      logger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(0);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(0);
    });
  })

  describe('configuring default log level', () => {
    let logger: Logger

    beforeEach(() => {
      (global as any).localStorage = {
        getItem () {
          return '{"*": 4}'
        },
        setItem () {
        }
      }
      logger = getLogger('AnyCategory')
    })

    it('should only log at or below the configured level for the category', () => {
      logger.debug('foo');
      logger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(0);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(1);
    });
  })

  describe('configuring log level for a category', () => {
    let logger: Logger
    let otherLogger: Logger

    beforeEach(() => {
      (global as any).localStorage = {
        getItem () {
          return '{"SomeSpecificCategory": 4}'
        },
        setItem () {
        }
      }
      logger = getLogger('SomeSpecificCategory')
      otherLogger = getLogger('OtherCategory')
    })

    it('should only log at or below the configured level for the category', () => {
      logger.debug('foo');
      logger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(0);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(1);
    });

    it('should log everything for other categories', () => {
      otherLogger.debug('foo');
      otherLogger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(1);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(1);
    });
  })

  describe('configuring log level with a wildcard', () => {
    let loggerA: Logger
    let loggerB: Logger
    let otherLogger: Logger

    beforeEach(() => {
      (global as any).localStorage = {
        getItem () {
          return '{"SomePrefix*": 4}'
        },
        setItem () {
        }
      }
      loggerA = getLogger('SomePrefixA')
      loggerB = getLogger('SomePrefixB')
      otherLogger = getLogger('OtherCategory')
    })

    it('should override log level for all matching categories', () => {
      loggerA.debug('foo');
      loggerA.error('bar');
      loggerB.debug('foo');
      loggerB.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(0);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(2);
    });

    it('should not override log level non-matching categories', () => {
      otherLogger.debug('foo');
      otherLogger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(1);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(1);
    });
  })

  describe('multiple matching log level configurations', () => {
    let logger: Logger

    beforeEach(() => {
      (global as any).localStorage = {
        getItem () {
          return '{"Some*": 4, "SomeCategory": 0}'
        },
        setItem () {
        }
      }
      logger = getLogger('SomeCategory')
    })

    it('should use the lowest matching level', () => {
      logger.debug('foo');
      logger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(0);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(0);
    });
  })

  describe('logger with a default level', () => {
    let logger: Logger

    beforeEach(() => {
      (global as any).localStorage = {
        getItem () {
        },
        setItem () {
        }
      }
      logger = getLogger('CategoryWithDefaultLevel', LoggerLevel.WARN)
    })

    it('should use the default log level', () => {
      logger.debug('foo');
      logger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(0);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(1);
    });
  })

  describe('overriding a logger with a default level', () => {
    let logger: Logger

    beforeEach(() => {
      (global as any).localStorage = {
        getItem () {
          return '{"*": 5}'
        },
        setItem () {
        }
      }
      logger = getLogger('CategoryWithDefaultLevel', LoggerLevel.WARN)
    })

    it('should use the logger-default log level', () => {
      logger.debug('foo');
      logger.error('bar');
      (global.console.debug as jest.Mock).mock.calls.length.should.be.equal(1);
      (global.console.error as jest.Mock).mock.calls.length.should.be.equal(1);
    });
  })
});
