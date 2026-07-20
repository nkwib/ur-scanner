/**
 * Bundle the demo into a single self-contained ESM file (demo/dist/demo.js) so
 * the demo directory is plain static HTML + one script, hostable anywhere with
 * no build step for the visitor. Inlines the library, @ngraveio/bc-ur, the QR
 * renderer, the jsqr fallback, and a Buffer polyfill (bc-ur is a Node-era pkg).
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

await build({
	entryPoints: [join(root, 'demo/src/main.js')],
	outfile: join(root, 'demo/dist/demo.js'),
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: 'es2020',
	minify: true,
	sourcemap: true,
	inject: [join(root, 'demo/src/buffer-shim.js')],
	define: { global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
	// bc-ur is a Node-era package; give it a minimal `process` before it loads.
	banner: {
		js: 'globalThis.process=globalThis.process||{env:{},argv:[],platform:"browser",browser:true,nextTick:function(f){Promise.resolve().then(f)}};'
	},
	logLevel: 'info'
});

console.log('demo bundled -> demo/dist/demo.js');
