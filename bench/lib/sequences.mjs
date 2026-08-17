/**
 * Shared payload sequences for the benchmarks. Deterministic by construction:
 * the same payload bytes and the same fragment size always yield the same part
 * strings, so numbers are comparable across runs and across machines.
 *
 * These are built at bench time rather than read from tests/fixtures/ because a
 * benchmark wants a size sweep (1 part, ~10 parts, ~50 parts), and committing
 * three more fixture files to serve only the bench would be dead weight.
 */
import { UR, UREncoder } from '@ngraveio/bc-ur';

/** Deterministic filler bytes: a repeating pattern, not random, so runs match. */
export function payload(bytes) {
	const text =
		'BC-UR turns a multi-kilobyte payload into a stream of QR frames a camera can recover. ';
	const out = new Uint8Array(bytes);
	const src = new TextEncoder().encode(text);
	for (let i = 0; i < bytes; i++) out[i] = src[i % src.length];
	return out;
}

/**
 * Build a fountain sequence: `overshoot` times the number of source fragments,
 * so callers can drop and reorder freely and still complete.
 *
 * @returns `{ parts, fragmentCount, payloadBytes, partLength }`
 */
export function sequence({ payloadBytes = 2048, fragmentLen = 100, overshoot = 3 } = {}) {
	const bytes = payload(payloadBytes);
	const enc = new UREncoder(UR.fromBuffer(Buffer.from(bytes)), fragmentLen, 0);
	const fragmentCount = enc.fragmentsLength;
	const parts = [];
	for (let i = 0; i < Math.max(fragmentCount + 1, fragmentCount * overshoot); i++) {
		parts.push(enc.nextPart());
	}
	return {
		parts,
		fragmentCount,
		payloadBytes,
		fragmentLen,
		partLength: parts[0].length
	};
}

/** The size sweep every bench reports on. Named so tables line up run to run. */
export const SIZES = [
	{ name: 'single-part (256 B)', payloadBytes: 256, fragmentLen: 500 },
	{ name: 'small (1 KB / 40 B frags)', payloadBytes: 1024, fragmentLen: 40 },
	{ name: 'medium (4 KB / 100 B frags)', payloadBytes: 4096, fragmentLen: 100 },
	{ name: 'large (16 KB / 100 B frags)', payloadBytes: 16384, fragmentLen: 100 }
];
