import { defineConfig } from 'tsup';

/**
 * Two entry points: the DOM-safe core (`index`) and the browser-only custom
 * element (`element`). ESM only, with declaration files. Runtime deps stay
 * external so consumers control the `@ngraveio/bc-ur` version and `jsqr` stays
 * optional.
 */
export default defineConfig({
	entry: ['src/index.ts', 'src/element.ts'],
	format: ['esm'],
	target: 'es2022',
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
	external: ['@ngraveio/bc-ur', 'jsqr']
});
