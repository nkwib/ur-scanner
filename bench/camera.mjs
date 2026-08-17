/**
 * Benchmark 2 of 3: the camera loop, headless, no webcam.
 *
 * Chromium can be handed a raw Y4M file as a fake camera device, so the whole
 * pipeline downstream of the lens is measurable in CI: `getUserMedia`, a real
 * `<video>`, the canvas, the detector, the receiver. `bench/lib/y4m.mjs`
 * renders the animated QR, holding each part for several frames the way a
 * 30 fps camera sees a 6 fps sender.
 *
 * What it cannot measure: the lens. No autofocus hunt, no motion blur, no
 * glare, no rolling shutter, and the detector that is available depends on the
 * host (Chromium exposes `BarcodeDetector` on macOS but not on Linux, so CI
 * measures the jsqr fallback path). The real-device number lives in
 * `demo/bench.html`.
 *
 * Usage: `pnpm bench:camera` (add `--json` for machine-readable output).
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bundleForBrowser, TMP } from './lib/build.mjs';
import { sequence } from './lib/sequences.mjs';
import { writeY4M } from './lib/y4m.mjs';

const JSON_OUT = process.argv.includes('--json');
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 60);
const REPEATS = Number(process.env.BENCH_REPEATS ?? 3);
const PORT = Number(process.env.BENCH_PORT ?? 4195);
const log = (...args) => JSON_OUT || console.log(...args);

// One camera rate, several sender rates. A fixed scan interval that keeps up
// with a slow sender can still alias badly against a fast one, and the only way
// to see that is to sweep the sender.
const CAMERA_FPS = 30;
const SENDERS = [
	{ hold: 5, label: '6 fps sender' },
	{ hold: 3, label: '10 fps sender' },
	{ hold: 2, label: '15 fps sender' },
	{ hold: 1, label: '30 fps sender' }
];

mkdirSync(TMP, { recursive: true });
const seq = sequence({ payloadBytes: 1024, fragmentLen: 100, overshoot: 1 });
const parts = seq.parts.slice(0, seq.fragmentCount + 4);

const bundle = await bundleForBrowser('bench/camera-page.js', 'camera-page.js');
const page = `<!doctype html><meta charset="utf-8"><title>camera bench</title>
<video id="v" playsinline muted style="width:240px"></video>
<script type="module" src="/camera-page.js"></script>`;

const server = createServer((req, res) => {
	if (req.url === '/camera-page.js') {
		res.writeHead(200, { 'content-type': 'text/javascript' });
		return res.end(readFileSync(bundle));
	}
	res.writeHead(200, { 'content-type': 'text/html' });
	res.end(page);
}).listen(PORT);

/**
 * Launch Chromium wired to one Y4M file, run `fn`, tear everything down.
 * `cpuThrottle` uses the CDP emulation the DevTools performance panel uses: a
 * crude but real stand-in for the budget Android phone this library is most
 * likely to disappoint, which no amount of desktop benchmarking would show.
 */
async function withCamera(y4mPath, fn, { cpuThrottle = 1 } = {}) {
	const browser = await chromium.launch({
		args: [
			'--use-fake-device-for-media-stream',
			'--use-fake-ui-for-media-stream',
			`--use-file-for-fake-video-capture=${y4mPath}`
		]
	});
	try {
		const context = await browser.newContext({ permissions: ['camera'] });
		const tab = await context.newPage();
		if (cpuThrottle > 1) {
			const cdp = await context.newCDPSession(tab);
			await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
		}
		// localhost is a secure context, which BarcodeDetector requires.
		await tab.goto(`http://localhost:${PORT}/`);
		await tab.waitForFunction(() => window.__benchReady === true);
		return await fn(tab);
	} finally {
		await browser.close();
	}
}

/** Median of repeated end-to-end runs: a fixed scan interval beats against the
 * sender's phase, so a single run is luck rather than a measurement. */
function medianRun(runs) {
	const ok = runs.filter((r) => r.complete);
	if (ok.length === 0) return { ...runs[0], repeats: runs.length };
	const sorted = [...ok].sort((a, b) => a.ms - b.ms);
	return { ...sorted[sorted.length >> 1], repeats: runs.length, completed: ok.length };
}

const results = { camera: {}, senders: [], stages: null, env: null };

for (const sender of SENDERS) {
	const path = join(TMP, `sender-${sender.hold}.y4m`);
	const meta = writeY4M(parts, { path, fps: CAMERA_FPS, hold: sender.hold });
	log(`generated ${sender.label}: ${meta.frames} frames, ${meta.modules} modules, ${meta.pxPerModule}px/module`);
	results.camera = { width: meta.width, height: meta.height, fps: meta.fps, qrModules: meta.modules, pxPerModule: meta.pxPerModule };

	const runs = await withCamera(path, async (tab) => {
		const env = await tab.evaluate(() => window.__bench.env());
		// Two configurations of the same loop: whatever the library defaults to,
		// and the same loop with the throttle explicitly removed.
		const repeat = async (options) => {
			const out = [];
			for (let i = 0; i < REPEATS; i++) {
				out.push(await tab.evaluate((o) => window.__bench.e2e(o), { timeoutMs: 25000, ...options }));
			}
			return medianRun(out);
		};
		return {
			env,
			asDefault: await repeat({}),
			uncapped: await repeat({ scanIntervalMs: 0 }),
			fallback: await repeat({ useFallback: true })
		};
	});
	results.env ??= runs.env;
	results.senders.push({ sender: sender.label, hold: sender.hold, ...runs });
	for (const [name, run] of Object.entries(runs)) {
		if (name === 'env') continue;
		log(`  ${name.padEnd(9)} ${run.complete ? `${run.ms} ms` : 'INCOMPLETE'}, ${run.scans} scans (${run.scansPerSec}/s)`);
	}
}

// Stage costs only need one video; use the slowest sender so the QR on screen
// holds still across a measurement the way a real one mostly does.
const standard = join(TMP, 'sender-5.y4m');
Object.assign(
	results,
	await withCamera(standard, async (tab) => ({
		canvasCost: await tab.evaluate(() => window.__bench.canvasCost()),
		resolutions: await tab.evaluate(() => window.__bench.resolutions())
	}))
);
results.canvasCostThrottled = await withCamera(
	standard,
	(tab) => tab.evaluate(() => window.__bench.canvasCost({ iterations: 100 })),
	{ cpuThrottle: 6 }
);

/**
 * The detect sweep, repeated across framings. Pixels per QR module is the
 * variable that decides whether downscaling before decode is free or fatal, and
 * `docs/howto/tuning.md` puts the working floor at 3 to 4. One generous 720p
 * framing, one at the floor, and one 1080p framing (what a phone camera
 * actually hands you) bracket the decision.
 */
results.framings = [];
for (const framing of [
	{ label: '720p, generous framing', width: 1280, height: 720, fill: 0.45 },
	{ label: '720p, tight framing', width: 1280, height: 720, fill: 0.28 },
	{ label: '1080p, generous framing', width: 1920, height: 1080, fill: 0.45 }
]) {
	const path = join(TMP, `framing-${framing.width}-${String(framing.fill).replace('.', '')}.y4m`);
	const meta = writeY4M(parts, { path, fps: CAMERA_FPS, hold: 5, ...framing });
	const stages = await withCamera(path, (tab) =>
		tab.evaluate((iterations) => window.__bench.stages({ iterations }), ITERATIONS)
	);
	results.framings.push({ label: framing.label, pxPerModule: meta.pxPerModule, qrModules: meta.modules, stages });
	log(`measured ${framing.label}: ${meta.pxPerModule} px/module`);
}

server.close();

if (JSON_OUT) {
	console.log(JSON.stringify(results, null, 2));
} else {
	const e = results.env;
	console.log(`\ndetector: ${e.nativeDetector ? 'native BarcodeDetector' : 'jsqr fallback'}, requestVideoFrameCallback: ${e.requestVideoFrameCallback}`);
	console.log(`fake camera: ${results.camera.width}x${results.camera.height} @ ${results.camera.fps} fps, QR ${results.camera.qrModules} modules at ${results.camera.pxPerModule} px/module\n`);

	console.log('end to end, camera to complete payload\n');
	console.log('| sender | config | time to complete | scans | scans/sec | frames seen |');
	console.log('| --- | --- | --- | --- | --- | --- |');
	for (const r of results.senders) {
		for (const [name, run] of [
			['library default', r.asDefault],
			['scanIntervalMs: 0', r.uncapped],
			['jsqr fallback, default', r.fallback]
		]) {
			console.log(`| ${r.sender} | ${name} | ${run.complete ? `${run.ms} ms` : `INCOMPLETE (${run.receivedParts}/${run.expectedPartCount})`} | ${run.scans} | ${run.scansPerSec} | ${run.framesSeen} |`);
		}
	}

	console.log('\ncanvas cost per scan (ms, tight loop)\n');
	console.log('| variant | full speed | 6x CPU throttle |');
	console.log('| --- | --- | --- |');
	console.log(`| resize + drawImage every scan (current) | ${results.canvasCost.resizeAndDraw.median} | ${results.canvasCostThrottled.resizeAndDraw.median} |`);
	console.log(`| drawImage only, resize when it changes | ${results.canvasCost.drawOnly.median} | ${results.canvasCostThrottled.drawOnly.median} |`);

	for (const f of results.framings) {
		console.log(`\nper-scan detect cost, ${f.label} (${f.pxPerModule} px per QR module, ${f.stages.videoSize})\n`);
		console.log('| stage | median ms | p95 ms | decoded |');
		console.log('| --- | --- | --- | --- |');
		for (const [name, value] of Object.entries(f.stages)) {
			if (!value || typeof value !== 'object') continue;
			console.log(`| ${name} | ${value.median} | ${value.p95} | ${value.decoded}/${value.iterations} |`);
		}
	}

	console.log('\ncapture resolution (candidate 5)\n');
	console.log('| constraints | negotiated | median detect ms | decoded |');
	console.log('| --- | --- | --- | --- |');
	for (const r of results.resolutions) {
		console.log(`| ${r.label} | ${r.negotiated ?? r.error} | ${r.median ?? '-'} | ${r.decoded ?? '-'}/${r.iterations ?? '-'} |`);
	}
	console.log('');
}
