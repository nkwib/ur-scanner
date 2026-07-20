/**
 * Proof of concept: automatically drive the demo and record a README-quality GIF.
 *
 * Pipeline: Playwright (headless Chromium, recordVideo) stages the sequence
 * deterministically -> webm -> ffmpeg two-pass palette encode -> GIF.
 *
 * Usage: PORT=4199 node scripts/serve-demo.mjs &
 *        node scripts/capture-gif.mjs [outDir]
 * Requires: ffmpeg on PATH, demo built (pnpm demo:build).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.PORT) || 4199;
const outDir = process.argv[2] || 'gif-out';
mkdirSync(outDir, { recursive: true });

const VIEW = { width: 1080, height: 860 };
const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: VIEW,
	recordVideo: { dir: outDir, size: VIEW },
	colorScheme: 'light',
	reducedMotion: 'no-preference'
});
const page = await context.newPage();

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

// Crop to the story: the title plus the two panels, nothing else.
const box = await page.evaluate(() => {
	const els = [document.querySelector('h1'), ...document.querySelectorAll('section.card')];
	let x1 = Infinity, y1 = Infinity, x2 = 0, y2 = 0;
	for (const el of els) {
		const r = el.getBoundingClientRect();
		x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top);
		x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom);
	}
	const pad = 14;
	return {
		x: Math.max(0, Math.floor(x1 - pad)),
		y: Math.max(0, Math.floor(y1 - pad)),
		w: Math.ceil(x2 - x1 + pad * 2),
		h: Math.ceil(y2 - y1 + pad * 2)
	};
});

// Stage 1: sender starts emitting fountain-coded frames.
await page.click('#encode');
await page.waitForTimeout(1200);

// Stage 2: receiver decodes the animated stream (fixture mode, no camera).
await page.click('#simulate');
await page.waitForSelector('#rx-out:not([hidden])', { timeout: 20_000 });

// Hold the landed state so the loop has a readable ending.
await page.waitForTimeout(1800);

await context.close();
await browser.close();

// Newest webm in outDir is our recording.
const webm = readdirSync(outDir)
	.filter((f) => f.endsWith('.webm'))
	.map((f) => join(outDir, f))
	.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

const gif = join(outDir, 'demo.gif');
// Two-pass palette: dramatically better colors and dithering than naive gif encode.
execFileSync('ffmpeg', [
	'-y',
	'-ss', '0.5',
	'-i', webm,
	'-filter_complex',
	`[0:v] crop=${box.w}:${box.h}:${box.x}:${box.y},fps=12,scale=820:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
	'-loop', '0',
	gif
], { stdio: 'inherit' });

const kb = Math.round(statSync(gif).size / 1024);
console.log(`\nGIF written: ${gif} (${kb} KB)`);
