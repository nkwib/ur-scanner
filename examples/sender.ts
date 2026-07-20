/**
 * The sender side, for completeness: this library only RECEIVES, but a demo or
 * test needs frames to receive. Encoding is `@ngraveio/bc-ur`'s job; pair it
 * with any QR renderer to paint each `nextPart()` onto a canvas on a timer.
 * Compiled by `pnpm typecheck`.
 */
import { UR, UREncoder } from '@ngraveio/bc-ur';

/** Produce a rateless animated-UR frame generator for arbitrary bytes. */
export function makeSender(payload: Uint8Array, fragmentSize = 90): () => string {
	const ur = UR.fromBuffer(Buffer.from(payload));
	const encoder = new UREncoder(ur, fragmentSize, 0);
	// Call this on each display tick; the stream is infinite and fountain-coded.
	return () => encoder.nextPart();
}

/** Capture a finite, redundant sequence (useful as a test fixture). */
export function captureSequence(payload: Uint8Array, fragmentSize = 90, overshoot = 3): string[] {
	const ur = UR.fromBuffer(Buffer.from(payload));
	const encoder = new UREncoder(ur, fragmentSize, 0);
	const parts: string[] = [];
	for (let i = 0; i < encoder.fragmentsLength * overshoot; i++) parts.push(encoder.nextPart());
	return parts;
}
