/**
 * Side-effectful, browser-only entry: importing it registers `<ur-scanner>`.
 *
 * ```ts
 * import '@nkwib/ur-scanner/element';
 * // <ur-scanner auto-start expected-type="bytes"></ur-scanner> now works
 * ```
 *
 * In SSR frameworks (Next.js, SvelteKit, Nuxt) import this only in the browser,
 * e.g. inside `useEffect`/`onMount`, or with a dynamic `import()`. See
 * `docs/howto/frameworks.md`.
 */
export { URScannerElement, defineURScanner } from './web-component.js';
import { defineURScanner } from './web-component.js';

defineURScanner();
