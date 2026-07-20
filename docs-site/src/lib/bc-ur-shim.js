/**
 * `@ngraveio/bc-ur` is a Node-era package that reaches for the `Buffer`,
 * `process`, and `global` globals that do not exist in a browser. The package's
 * own esbuild demo solved this with an `inject`ed buffer shim plus a `process`
 * banner. Vite has no per-entry `inject`, so we do the equivalent at runtime:
 * install the globals from the `buffer` polyfill BEFORE the first dynamic import
 * of bc-ur (or anything that pulls it in, like `<ur-scanner>`'s element entry).
 *
 * Call and AWAIT this before importing bc-ur / the scanner element. ES module
 * evaluation order then guarantees the globals exist when bc-ur's top-level
 * code runs. Returns the `Buffer` constructor for convenience.
 */
export async function installBcUrGlobals() {
  const { Buffer } = await import('buffer');
  if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = Buffer;
  if (typeof globalThis.global === 'undefined') globalThis.global = globalThis;
  if (typeof globalThis.process === 'undefined') {
    globalThis.process = {
      env: {},
      argv: [],
      platform: 'browser',
      browser: true,
      nextTick: (fn, ...args) => Promise.resolve().then(() => fn(...args))
    };
  }
  return globalThis.Buffer;
}
