import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // `@ngraveio/bc-ur` is a Node-era package that reaches for the `Buffer`/`process`
  // globals. We provide those at runtime in the demo (see src/lib/bc-ur-shim.js,
  // loaded before the first dynamic import), so here we only need Vite to
  // pre-bundle the CJS/Node deps into clean ESM. The `<ur-scanner>` package is
  // linked via `file:..`; its leaf deps (bc-ur, jsqr) are resolved from our own
  // node_modules, hence listed as direct dependencies too.
  optimizeDeps: {
    include: ['@ngraveio/bc-ur', 'qrcode', 'buffer', 'jsqr', 'mermaid']
  },
  ssr: {
    noExternal: ['@nkwib/ur-scanner']
  }
});
