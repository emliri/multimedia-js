export const perf: Performance = performance;

// note: perf.now() may return *any* value here (even negative)
// outside the range of Date it is still fine for belows assumptions.
export const wallClkBaseTime = Date.now() - perf.now();

/**
 *
 * @returns performance API timing precise clock value (not an epoch i.e wallclock value)
 */
export function getPerfNow(): number {
  return perf.now();
}

/**
 *
 * @returns wallclock time (epoch millis same as Date.now) in performance API precision
 */
export function getPerfWallClockTime(): number {
  return wallClkBaseTime + perf.now();
}

