import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test of the real demo in a real browser: exercises bc-ur encode ->
 * <ur-scanner> fixture mode -> decode, end-to-end, with no camera hardware.
 * Run `pnpm demo:build` first (the webServer serves the built bundle).
 */
export default defineConfig({
	testDir: './tests/e2e',
	timeout: 30_000,
	use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
	webServer: {
		command: 'node scripts/serve-demo.mjs',
		url: 'http://localhost:4173/',
		reuseExistingServer: true,
		timeout: 20_000,
		env: { PORT: '4173' }
	}
});
