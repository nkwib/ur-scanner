/**
 * Bundle a TypeScript entry into `bench/.tmp/` with esbuild so the benchmarks
 * measure the working tree, not a stale `dist/`. Running `pnpm build` first is
 * then never a prerequisite, and a bench run always reflects the edit you just
 * made.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TMP = join(ROOT, 'bench', '.tmp');

/** Bundle for Node. `@ngraveio/bc-ur` stays external (it resolves fine there). */
export async function bundleForNode(entry, outName) {
	mkdirSync(TMP, { recursive: true });
	const outfile = join(TMP, outName);
	await build({
		entryPoints: [join(ROOT, entry)],
		outfile,
		bundle: true,
		format: 'esm',
		platform: 'node',
		target: 'node20',
		external: ['@ngraveio/bc-ur', 'jsqr'],
		logLevel: 'error'
	});
	return pathToFileURL(outfile).href;
}

/**
 * Bundle for the browser. Inlines everything including `jsqr` and a Buffer
 * shim, the same way `scripts/build-demo.mjs` does (bc-ur is a Node-era
 * package, so it needs `Buffer` and a `process` before it loads).
 */
export async function bundleForBrowser(entry, outName) {
	mkdirSync(TMP, { recursive: true });
	const outfile = join(TMP, outName);
	await build({
		entryPoints: [join(ROOT, entry)],
		outfile,
		bundle: true,
		format: 'esm',
		platform: 'browser',
		target: 'es2022',
		inject: [join(ROOT, 'demo/src/buffer-shim.js')],
		define: { global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
		banner: {
			js: 'globalThis.process=globalThis.process||{env:{},argv:[],platform:"browser",browser:true,nextTick:function(f){Promise.resolve().then(f)}};'
		},
		logLevel: 'error'
	});
	return outfile;
}
