import { describe, expect, it, vi } from 'vitest';
import { URReceiver } from '../src/receiver.js';
import { dropFraction, shuffle } from '../src/sources/fixture.js';
import { bytesToHex, loadFixture } from './helpers.js';

const multi = loadFixture('bytes.multipart.json');
const single = loadFixture('bytes.single.json');
const foreign = loadFixture('foreign.multipart.json');

describe('URReceiver decode core', () => {
	it('reconstructs the exact payload from an in-order stream', () => {
		const rx = new URReceiver();
		let done = false;
		for (const part of multi.parts) {
			if (rx.addPart(part).complete) {
				done = true;
				break;
			}
		}
		expect(done).toBe(true);
		expect(rx.type).toBe('bytes');
	});

	it('exposes honest fountain progress semantics', () => {
		const rx = new URReceiver();
		const p0 = rx.progress;
		expect(p0.canStartAnywhere).toBe(true);
		expect(p0.expectedPartCount).toBe(0);
		const p1 = rx.addPart(multi.parts[0]!);
		expect(p1.type).toBe('bytes');
		expect(p1.expectedPartCount).toBe(multi.fragmentCount);
		expect(p1.estimatedPercent).toBeGreaterThanOrEqual(0);
		expect(p1.estimatedPercent).toBeLessThanOrEqual(1);
	});

	it('recovers from an out-of-order stream (frame 7 before frame 1)', () => {
		const rx = new URReceiver();
		const reordered = shuffle(multi.parts, 7);
		let out: Uint8Array | null = null;
		rx.on('complete', (u) => (out = u.cbor));
		for (const part of reordered) if (rx.addPart(part).complete) break;
		expect(rx.isComplete).toBe(true);
		expect(out).not.toBeNull();
	});

	it('recovers under 40% frame loss (the fountain-code promise)', () => {
		const lossy = shuffle(dropFraction(multi.parts, 0.4, 3), 9);
		const rx = new URReceiver();
		let decodedHex = '';
		rx.on('complete', (u) => (decodedHex = bytesToHex(u.decodeCbor() as Uint8Array)));
		for (const part of lossy) if (rx.addPart(part).complete) break;
		expect(rx.isComplete).toBe(true);
		expect(decodedHex).toBe(multi.payloadHex);
	});

	it('treats duplicate frames idempotently', () => {
		const rx = new URReceiver();
		const ignored: string[] = [];
		rx.on('ignore', (i) => ignored.push(i.reason));
		rx.addPart(multi.parts[0]!);
		const afterFirst = rx.progress.receivedParts;
		const afterDup = rx.addPart(multi.parts[0]!);
		expect(afterDup.receivedParts).toBe(afterFirst);
		expect(afterDup.framesSeen).toBe(2);
		expect(ignored).toContain('duplicate');
	});

	it('ignores non-UR noise but still completes', () => {
		const rx = new URReceiver();
		const reasons: string[] = [];
		rx.on('ignore', (i) => reasons.push(i.reason));
		rx.addPart('https://example.com/not-a-ur');
		rx.addPart('WIFI:S:home;;');
		for (const part of multi.parts) if (rx.addPart(part).complete) break;
		expect(rx.isComplete).toBe(true);
		expect(reasons).toContain('not-a-ur');
	});

	it('detects a foreign UR type mid-scan without derailing', () => {
		const rx = new URReceiver();
		const errors: string[] = [];
		rx.on('error', (e) => errors.push(e.code));
		rx.addPart(multi.parts[0]!);
		rx.addPart(foreign.parts[0]!); // wrong type wanders into frame
		for (const part of multi.parts) if (rx.addPart(part).complete) break;
		expect(errors).toContain('MIXED_UR_TYPES');
		expect(rx.isComplete).toBe(true);
		expect(rx.type).toBe('bytes');
	});

	it('enforces expectedType and rejects a mismatch', () => {
		const rx = new URReceiver({ expectedType: 'crypto-hdkey' });
		const errors: string[] = [];
		rx.on('error', (e) => errors.push(e.code));
		rx.addPart(multi.parts[0]!);
		expect(errors).toContain('UNEXPECTED_TYPE');
		expect(rx.isComplete).toBe(false);
	});

	it('flags a single-part UR as not needing animation', () => {
		const rx = new URReceiver();
		let result;
		rx.on('complete', (u) => (result = u));
		rx.addPart(single.parts[0]!);
		expect(rx.isComplete).toBe(true);
		expect(result!.wasSinglePart).toBe(true);
	});

	it('fires the onComplete option callback with the decoded bytes', () => {
		const onComplete = vi.fn();
		const rx = new URReceiver({ onComplete });
		for (const part of multi.parts) if (rx.addPart(part).complete) break;
		expect(onComplete).toHaveBeenCalledOnce();
		const arg = onComplete.mock.calls[0]![0];
		expect(arg.type).toBe('bytes');
		expect(arg.cbor).toBeInstanceOf(Uint8Array);
	});

	it('unsubscribes listeners via the returned disposer', () => {
		const rx = new URReceiver();
		const spy = vi.fn();
		const off = rx.on('progress', spy);
		rx.addPart(multi.parts[0]!);
		off();
		rx.addPart(multi.parts[1]!);
		expect(spy).toHaveBeenCalledOnce();
	});

	it('reset() clears state to start a fresh scan', () => {
		const rx = new URReceiver();
		rx.addPart(multi.parts[0]!);
		rx.reset();
		expect(rx.type).toBeNull();
		expect(rx.progress.framesSeen).toBe(0);
		expect(rx.progress.receivedParts).toBe(0);
	});
});
