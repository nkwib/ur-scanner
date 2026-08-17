import { expect, test } from '@playwright/test';

/**
 * The camera path, end to end, with no camera. Chromium plays a generated
 * animated-QR video back as a fake capture device (see `fake-camera.mjs`), so
 * this covers `getUserMedia` -> `<video>` -> detector -> `URReceiver` -> bytes.
 * It is the only automated test that exercises the scan loop itself.
 */
test('decodes an animated UR from a camera stream', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));

	await page.goto('/bench.html');
	await page.getByRole('button', { name: 'Start scan' }).click();

	await expect(page.locator('#status')).toHaveText('Complete.', { timeout: 45_000 });

	// The reported numbers should be real, not placeholders.
	await expect(page.locator('#m-time')).toContainText('ms');
	const parts = await page.locator('#m-parts').textContent();
	expect(parts).toMatch(/^(\d+) \/ \1$/);
	expect(errors).toEqual([]);
});
