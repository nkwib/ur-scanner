import { defineConfig, devices } from '@playwright/test';
import { FAKE_CAMERA_Y4M } from './tests/e2e/fake-camera.mjs';

/**
 * Smoke test of the real demo in a real browser: exercises bc-ur encode ->
 * <ur-scanner> fixture mode -> decode, end-to-end, with no camera hardware.
 * Run `pnpm demo:build` first (the webServer serves the built bundle).
 *
 * Chromium is also handed a generated Y4M file as a fake camera device, so the
 * camera loop itself (getUserMedia -> video -> detector -> receiver) is covered
 * rather than only the fixture path. `globalSetup` renders that video.
 */
export default defineConfig({
	testDir: './tests/e2e',
	timeout: 60_000,
	globalSetup: './tests/e2e/fake-camera.mjs',
	use: {
		...devices['Desktop Chrome'],
		baseURL: 'http://localhost:4173',
		permissions: ['camera'],
		launchOptions: {
			args: [
				'--use-fake-device-for-media-stream',
				'--use-fake-ui-for-media-stream',
				`--use-file-for-fake-video-capture=${FAKE_CAMERA_Y4M}`
			]
		}
	},
	webServer: {
		command: 'node scripts/serve-demo.mjs',
		url: 'http://localhost:4173/',
		reuseExistingServer: true,
		timeout: 20_000,
		env: { PORT: '4173' }
	}
});
