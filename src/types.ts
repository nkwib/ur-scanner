/**
 * Shared value types for the decode core. No DOM, no dependency imports: this
 * file is safe to import from anywhere, including a server bundle.
 */
import type { URScannerError } from './errors.js';

/**
 * An honest snapshot of decode progress. Because multipart UR is fountain-coded,
 * the numbers describe *recovery*, not a byte offset: you can join a stream at
 * any frame (`canStartAnywhere`), and `estimatedPercent` is an estimate the
 * decoder revises as mixed parts resolve. See `docs/explanation/fountain-codes.md`.
 */
export interface Progress {
	/** UR type locked on the first accepted part (e.g. `"bytes"`), or `null`. */
	type: string | null;
	/** Number of distinct source fragments recovered so far. */
	receivedParts: number;
	/**
	 * Total source fragments the payload was split into. `0` until the first
	 * well-formed part is seen; for a single-part UR this is `1`.
	 */
	expectedPartCount: number;
	/** Decoder's own 0..1 completion estimate. Not `receivedParts/expected`. */
	estimatedPercent: number;
	/** Total raw frames fed in, including duplicates and ignored noise. */
	framesSeen: number;
	/** A fact about fountain codes, surfaced so UIs can reassure the user. */
	readonly canStartAnywhere: true;
	/** `true` once the payload is fully recovered. */
	complete: boolean;
}

/** The recovered payload, delivered once on completion. Payloads are just bytes. */
export interface DecodedUR {
	/** UR type, e.g. `"bytes"` or a registry type like `"crypto-hdkey"`. */
	type: string;
	/** The raw UR body: the CBOR-encoded payload, as bytes. Always present. */
	cbor: Uint8Array;
	/**
	 * `true` when the whole payload arrived in one static QR (no animation was
	 * needed). Informational, not an error: see the taxonomy in the reference.
	 */
	wasSinglePart: boolean;
	/**
	 * Convenience: the CBOR-decoded value. For `ur:bytes` this is your raw payload
	 * bytes; for a registry type it is the decoded structure. Throws if the CBOR
	 * body cannot be decoded. Lazy, so undecodable bodies never break completion.
	 */
	decodeCbor(): unknown;
}

/** Why a frame was skipped instead of accepted. Emitted via the `ignore` event. */
export interface IgnoredFrame {
	reason: 'not-a-ur' | 'mixed-type' | 'malformed' | 'duplicate';
	/** The offending raw text (truncated for logging). */
	text: string;
	/** The UR type that was seen, when the reason is `mixed-type`. */
	seenType?: string;
}

/** Options accepted by {@link URReceiver} and forwarded by the frame sources. */
export interface URReceiverOptions {
	/** Reject any part whose UR type is not this (case-insensitive). */
	expectedType?: string;
	/**
	 * Emit a `DECODE_STALL` error if this many milliseconds pass without a *new*
	 * part while still incomplete. Off by default (pure, deterministic core).
	 */
	stallTimeoutMs?: number;
	onProgress?: (progress: Progress) => void;
	onComplete?: (result: DecodedUR) => void;
	onError?: (error: URScannerError) => void;
	onIgnore?: (info: IgnoredFrame) => void;
}

/** Event names emitted by {@link URReceiver}. */
export type URReceiverEvents = {
	progress: Progress;
	complete: DecodedUR;
	error: URScannerError;
	ignore: IgnoredFrame;
};
