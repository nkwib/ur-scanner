// bc-ur (a Node-era package) references the `Buffer` global. In the browser we
// provide it from the `buffer` polyfill; esbuild's `inject` rewrites every
// unbound `Buffer` reference to this export.
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = Buffer;
export { Buffer };
