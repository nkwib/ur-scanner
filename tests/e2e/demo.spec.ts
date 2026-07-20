import { expect, test } from '@playwright/test';

/**
 * The one-device path proves the whole pipeline without a camera: the demo
 * encodes a payload with @ngraveio/bc-ur, feeds its own animated frames into
 * this library's <ur-scanner>, and the element decodes them back to bytes.
 */
test('scans a simulated animated UR back to the original text', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Simulate (no camera)' }).click();

	const out = page.locator('#rx-out');
	await expect(out).toBeVisible({ timeout: 15_000 });
	await expect(out).toContainText('Uniform Resources');

	await expect(page.locator('#rx-status')).toContainText('bytes');
});

test('the receiver is a registered custom element with a shadow root', async ({ page }) => {
	await page.goto('/');
	const hasShadow = await page.evaluate(() => {
		const el = document.querySelector('ur-scanner');
		return Boolean(el && (el as HTMLElement).shadowRoot?.querySelector('[part="ring"]'));
	});
	expect(hasShadow).toBe(true);
});
