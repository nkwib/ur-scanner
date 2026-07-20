import { describe, expect, it, vi } from 'vitest';
import { dropFraction, fromFixture, playFixture, shuffle } from '../src/sources/fixture.js';
import { bytesToHex, loadFixture } from './helpers.js';

const multi = loadFixture('bytes.multipart.json');

describe('fromFixture (camera-free source)', () => {
	it('decodes a clean sequence end-to-end', () => {
		const { progress, receiver } = fromFixture(multi.parts);
		expect(progress.complete).toBe(true);
		expect(receiver.type).toBe('bytes');
	});

	it('decodes a shuffled, 40%-lossy sequence end-to-end', () => {
		const lossy = shuffle(dropFraction(multi.parts, 0.4, 11), 5);
		const { receiver } = fromFixture(lossy);
		expect(receiver.isComplete).toBe(true);
	});

	it('threads state across calls via a shared receiver', () => {
		const { receiver } = fromFixture(multi.parts.slice(0, 3));
		expect(receiver.isComplete).toBe(false);
		const { progress } = fromFixture(multi.parts, { receiver });
		expect(progress.complete).toBe(true);
	});
});

describe('playFixture (timed animation)', () => {
	it('completes when played on a timer', async () => {
		vi.useFakeTimers();
		try {
			const onFrame = vi.fn();
			const { done } = playFixture(multi.parts, { intervalMs: 10, onFrame });
			await vi.advanceTimersByTimeAsync(multi.parts.length * 10 + 10);
			const progress = await done;
			expect(progress.complete).toBe(true);
			expect(onFrame).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('stop() halts playback and resolves', async () => {
		vi.useFakeTimers();
		try {
			const { stop, done } = playFixture(multi.parts, { intervalMs: 10 });
			await vi.advanceTimersByTimeAsync(15);
			stop();
			const progress = await done;
			expect(progress.complete).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('decodeCbor round-trip', () => {
	it('returns the exact original payload bytes for ur:bytes', () => {
		let hex = '';
		fromFixture(multi.parts, {
			onComplete: (u) => (hex = bytesToHex(u.decodeCbor() as Uint8Array))
		});
		expect(hex).toBe(multi.payloadHex);
	});
});
