import { describe, expect, it } from 'vitest';
import { URReceiver } from '../src/receiver.js';
import { fromFixture, shuffle } from '../src/sources/fixture.js';
import { bytesToHex, loadFixture } from './helpers.js';

const multi = loadFixture('bytes.multipart.json');
const single = loadFixture('bytes.single.json');

/**
 * URs are case agnostic, and the spec calls for UPPERCASE on QR transport: an
 * all-uppercase string encodes in QR alphanumeric mode at 5.5 bits per
 * character instead of byte mode's 8, so about 1.45x the payload fits in the
 * same frame. Spec-correct senders therefore emit uppercase, and a receiver
 * that only handled lowercase would silently fail against the senders with the
 * best throughput. These cover the whole string, including the `ur:` scheme,
 * the type, and the `seq-num-total` header the multipart path parses itself.
 */
const upper = (part: string) => part.toUpperCase();

/** Uppercase scheme, type and sequence header; lowercase bytewords payload. */
const mixed = (part: string) => {
	const cut = part.lastIndexOf('/');
	return part.slice(0, cut).toUpperCase() + part.slice(cut);
};

describe('UR case handling', () => {
	it('decodes an all-uppercase multipart sequence', () => {
		const { progress, receiver } = fromFixture(multi.parts.map(upper));
		expect(progress.complete).toBe(true);
		// The locked type is normalised, so app code can compare it directly.
		expect(receiver.type).toBe('bytes');
	});

	it('recovers the exact payload bytes from uppercase parts', () => {
		let hex = '';
		fromFixture(multi.parts.map(upper), {
			onComplete: (u) => (hex = bytesToHex(u.decodeCbor() as Uint8Array))
		});
		expect(hex).toBe(multi.payloadHex);
	});

	it('reads the multipart sequence header regardless of case', () => {
		// wasSinglePart is derived from our own parse of the `1-10/` header, so a
		// case-sensitive regex there would mislabel an animated scan as static.
		let result;
		const rx = new URReceiver({ onComplete: (u) => (result = u) });
		for (const part of multi.parts.map(upper)) if (rx.addPart(part).complete) break;
		expect(result!.wasSinglePart).toBe(false);
		expect(rx.progress.expectedPartCount).toBe(multi.fragmentCount);
	});

	it('decodes an uppercase single-part UR', () => {
		const { progress } = fromFixture([upper(single.parts[0]!)]);
		expect(progress.complete).toBe(true);
	});

	it('decodes a mixed-case sequence', () => {
		const { progress } = fromFixture(multi.parts.map(mixed));
		expect(progress.complete).toBe(true);
	});

	it('decodes a stream whose case changes mid-scan', () => {
		// Two senders, or one sender changed mid-stream: neither should matter.
		const alternating = multi.parts.map((p, i) => (i % 2 ? upper(p) : p));
		const { progress } = fromFixture(shuffle(alternating, 4));
		expect(progress.complete).toBe(true);
	});

	it('treats the same part in a different case as a duplicate, not new data', () => {
		const rx = new URReceiver();
		const reasons: string[] = [];
		rx.on('ignore', (i) => reasons.push(i.reason));
		rx.addPart(multi.parts[0]!);
		const received = rx.progress.receivedParts;
		const after = rx.addPart(upper(multi.parts[0]!));
		expect(after.receivedParts).toBe(received);
		expect(reasons).toContain('duplicate');
	});

	it('matches expectedType against an uppercase UR', () => {
		const errors: string[] = [];
		const rx = new URReceiver({ expectedType: 'bytes' });
		rx.on('error', (e) => errors.push(e.code));
		rx.addPart(upper(multi.parts[0]!));
		expect(errors).toEqual([]);
		expect(rx.type).toBe('bytes');
	});

	it('still rejects an uppercase UR of the wrong type', () => {
		const errors: string[] = [];
		const rx = new URReceiver({ expectedType: 'crypto-hdkey' });
		rx.on('error', (e) => errors.push(e.code));
		rx.addPart(upper(multi.parts[0]!));
		expect(errors).toContain('UNEXPECTED_TYPE');
	});
});
