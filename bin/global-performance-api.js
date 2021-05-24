let performance;

try {
  const perf_hooks = require('perf_hooks');
  performance = perf_hooks.performance;
} catch (_) {
  console.warn('Missing `perf_hooks` module (upgrade your Node-js runtime); falling back to hrtime based shim!');
  performance = {
    now: function (start) {
      if (!start) return process.hrtime();
      const end = process.hrtime(start);
      return Math.round((end[0] * 1000) + (end[1] / 1000000));
    }
  };
}

global.performance = performance;
