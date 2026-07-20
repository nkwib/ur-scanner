/**
 * The camera-free frame source: feed a known array of UR part strings into a
 * receiver. This is what tests, CI, and the demo's one-device mode use, and
 * what downstream apps use to unit-test their integration without a webcam.
 * See `docs/howto/testing.md`.
 */
import { URReceiver } from '../receiver.js';
import type { Progress, URReceiverOptions } from '../types.js';

export interface FixtureOptions extends URReceiverOptions {
	/** Reuse an existing receiver instead of creating one (thread state across calls). */
	receiver?: URReceiver;
}

/**
 * Feed `parts` into a receiver synchronously and return `{ receiver, progress }`.
 * Order-independent and loss-tolerant by construction (that is the whole point
 * of fountain codes), so tests can shuffle and drop parts freely.
 *
 * @example
 * ```ts
 * const { progress } = fromFixture(parts);
 * expect(progress.complete).toBe(true);
 * ```
 */
export function fromFixture(
	parts: string[],
	options: FixtureOptions = {}
): { receiver: URReceiver; progress: Progress } {
	const receiver = options.receiver ?? new URReceiver(options);
	let progress = receiver.progress;
	for (const part of parts) {
		progress = receiver.addPart(part);
		if (progress.complete) break;
	}
	return { receiver, progress };
}

/**
 * Play `parts` into a receiver on a timer, mimicking an animated display. Returns
 * a controller with `stop()`. Used by the demo's fixture mode and by synthetic
 * end-to-end tests. Resolves when the stream completes or the parts run out.
 */
export function playFixture(
	parts: string[],
	options: FixtureOptions & { intervalMs?: number; loop?: boolean; onFrame?: (part: string, index: number) => void } = {}
): { receiver: URReceiver; stop: () => void; done: Promise<Progress> } {
	const receiver = options.receiver ?? new URReceiver(options);
	const interval = options.intervalMs ?? 200;
	let i = 0;
	let timer: ReturnType<typeof setInterval> | null = null;
	let resolveDone!: (p: Progress) => void;
	const done = new Promise<Progress>((res) => (resolveDone = res));

	const stop = () => {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
		resolveDone(receiver.progress);
	};

	timer = setInterval(() => {
		if (i >= parts.length) {
			if (options.loop) i = 0;
			else return stop();
		}
		const part = parts[i]!;
		options.onFrame?.(part, i);
		i++;
		const progress = receiver.addPart(part);
		if (progress.complete) stop();
	}, interval);
	(timer as { unref?: () => void }).unref?.();

	return { receiver, stop, done };
}

// ── Test utilities (deterministic loss/reorder) ───────────────────────────────

/** Deterministic PRNG (mulberry32) so lossy/shuffled tests are reproducible. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Return a new array with `fraction` (0..1) of `parts` dropped, deterministically. */
export function dropFraction<T>(parts: T[], fraction: number, seed = 1): T[] {
	const rand = mulberry32(seed);
	return parts.filter(() => rand() >= fraction);
}

/** Return a deterministically shuffled copy of `parts` (Fisher-Yates). */
export function shuffle<T>(parts: T[], seed = 1): T[] {
	const rand = mulberry32(seed);
	const out = parts.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}
