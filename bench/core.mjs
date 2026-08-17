/**
 * Benchmark 1 of 3: the pure decode core, headless in Node, no browser.
 *
 * Answers "how many frames and how much wall clock does an N-part UR cost once
 * the strings are already in hand", plus the per-frame cost of the three things
 * a camera loop actually feeds a receiver: a new part, a duplicate part (the
 * common case, since a camera re-reads the same frame several times), and
 * non-UR noise.
 *
 * This is the number that is honest to quote in CI. It deliberately excludes
 * the camera, the canvas, and the detector: see `bench/camera.mjs` for those
 * and `demo/bench.html` for the only number a real device can produce.
 *
 * Usage: `pnpm bench` (add `--json` for machine-readable output).
 */
import { bundleForNode } from './lib/build.mjs';
import { SIZES, sequence } from './lib/sequences.mjs';

const { URReceiver, dropFraction, shuffle } = await import(
	await bundleForNode('src/index.ts', 'core.mjs')
);

const REPEATS = Number(process.env.BENCH_REPEATS ?? 30);

/** Median is the right summary here: GC pauses make the mean lie. */
function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(n, places = 2) {
	return Number(n.toFixed(places));
}

/** Feed parts until complete; return frames consumed and wall-clock ms. */
function decodeOnce(parts) {
	const rx = new URReceiver();
	const started = performance.now();
	let frames = 0;
	for (const part of parts) {
		frames++;
		if (rx.addPart(part).complete) break;
	}
	const ms = performance.now() - started;
	return { frames, ms, complete: rx.isComplete };
}

function measureStream(parts, label) {
	const runs = [];
	for (let i = 0; i < REPEATS; i++) runs.push(decodeOnce(parts));
	const first = runs[0];
	if (!first.complete) throw new Error(`bench stream "${label}" never completed`);
	return {
		label,
		framesToComplete: first.frames,
		ms: round(median(runs.map((r) => r.ms)), 3),
		msPerFrame: round(median(runs.map((r) => r.ms / r.frames)), 4)
	};
}

/**
 * Per-frame cost by outcome. A camera loop spends most of its frames on
 * duplicates, so that column matters more than the accepted-part column.
 */
function measureFrameCost(parts) {
	const cost = (setup, frame, iterations = 2000) => {
		const samples = [];
		for (let r = 0; r < 5; r++) {
			const rx = setup();
			const started = performance.now();
			for (let i = 0; i < iterations; i++) rx.addPart(frame);
			samples.push(((performance.now() - started) / iterations) * 1000);
		}
		return round(median(samples), 2);
	};

	// A receiver primed with one part, then re-fed that same part: the duplicate path.
	const primed = () => {
		const rx = new URReceiver();
		rx.addPart(parts[0]);
		return rx;
	};

	// A single-part UR completes on that first part, and a complete receiver
	// short-circuits every later frame, so its costs are not comparable.
	if (primed().isComplete) return { duplicateUs: null, noiseUs: null, emptyUs: null };

	return {
		duplicateUs: cost(primed, parts[0]),
		noiseUs: cost(primed, 'https://example.com/not-a-ur'),
		emptyUs: cost(primed, '')
	};
}

const results = [];
for (const size of SIZES) {
	const seq = sequence(size);
	const inOrder = measureStream(seq.parts, 'in order');
	const shuffled = measureStream(shuffle(seq.parts, 7), 'shuffled');
	const lossy = measureStream(shuffle(dropFraction(seq.parts, 0.4, 3), 9), '40% loss');
	results.push({
		scenario: size.name,
		fragmentCount: seq.fragmentCount,
		partLength: seq.partLength,
		streams: { inOrder, shuffled, lossy },
		frameCost: measureFrameCost(seq.parts)
	});
}

if (process.argv.includes('--json')) {
	console.log(JSON.stringify({ repeats: REPEATS, node: process.version, results }, null, 2));
} else {
	console.log(`\ndecode core, node ${process.version}, median of ${REPEATS} runs\n`);
	console.log('| scenario | K | part len | frames to complete (in order / shuffled / 40% loss) | ms to complete (in order) | ms per frame |');
	console.log('| --- | --- | --- | --- | --- | --- |');
	for (const r of results) {
		const { inOrder, shuffled, lossy } = r.streams;
		console.log(
			`| ${r.scenario} | ${r.fragmentCount} | ${r.partLength} | ${inOrder.framesToComplete} / ${shuffled.framesToComplete} / ${lossy.framesToComplete} | ${inOrder.ms} | ${inOrder.msPerFrame} |`
		);
	}
	console.log('\nper-frame cost by outcome (microseconds, the loop overhead per scanned frame)\n');
	console.log('| scenario | duplicate part | non-UR noise | empty string |');
	console.log('| --- | --- | --- | --- |');
	for (const r of results) {
		const c = r.frameCost;
		const us = (v) => (v === null ? 'n/a (completes on frame 1)' : `${v} us`);
		console.log(`| ${r.scenario} | ${us(c.duplicateUs)} | ${us(c.noiseUs)} | ${us(c.emptyUs)} |`);
	}
	console.log('');
}
