/**
 * Tiny server-side timing helper.
 *
 * Wraps an async function and logs `[PERF-SRV] <label> <ms>` so it shows
 * up in Vercel function logs. Returns the wrapped function's result.
 *
 * Usage:
 *   const session = await perfLog("getSession", () => getSession());
 *
 * Diagnostic-only. Strip once perf issues are tracked down.
 */
export async function perfLog<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const dur = Date.now() - start;
    console.log(`[PERF-SRV] ${label} ${dur}ms`);
    return result;
  } catch (err) {
    const dur = Date.now() - start;
    console.log(`[PERF-SRV] ${label} ${dur}ms (errored)`);
    throw err;
  }
}
