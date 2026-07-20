/**
 * The complete error taxonomy for a browser UR receiver. Every failure a caller
 * can hit surfaces as a {@link URScannerError} with a stable, machine-readable
 * {@link URScannerErrorCode}, so downstream UIs can branch on `code` instead of
 * matching English strings. See `docs/reference.md` for the full table and the
 * recommended user-facing copy for each.
 */

/** Stable, machine-readable discriminant for every failure mode. */
export type URScannerErrorCode =
	/** Camera APIs require HTTPS (or `localhost`). Served over plain HTTP. */
	| 'INSECURE_CONTEXT'
	/** `navigator.mediaDevices.getUserMedia` is missing (old/embedded webview). */
	| 'CAMERA_UNSUPPORTED'
	/** The user (or a policy) denied camera access. Maps `NotAllowedError`. */
	| 'CAMERA_PERMISSION_DENIED'
	/** No camera device is available. Maps `NotFoundError`/`OverconstrainedError`. */
	| 'CAMERA_NOT_FOUND'
	/** Neither native `BarcodeDetector` nor the optional `jsqr` fallback is usable. */
	| 'DETECTOR_UNSUPPORTED'
	/** A part decoded, but its UR type does not match `expectedType`. */
	| 'UNEXPECTED_TYPE'
	/** After a type locked, a part of a *different* UR type appeared. Non-fatal. */
	| 'MIXED_UR_TYPES'
	/** No new part arrived within `stallTimeoutMs` while still incomplete. */
	| 'DECODE_STALL'
	/** The fountain decoder reported an unrecoverable error for the stream. */
	| 'DECODE_FAILED';

/** The single error type thrown/emitted by every layer of the library. */
export class URScannerError extends Error {
	readonly code: URScannerErrorCode;
	override readonly cause?: unknown;

	constructor(code: URScannerErrorCode, message: string, cause?: unknown) {
		super(message);
		this.name = 'URScannerError';
		this.code = code;
		this.cause = cause;
		// Restore the prototype chain for instanceof across down-compiled targets.
		Object.setPrototypeOf(this, URScannerError.prototype);
	}
}

/**
 * Translate a `getUserMedia` / `MediaDevices` rejection into a typed
 * {@link URScannerError}. Browsers throw `DOMException`s whose `.name` is the
 * only stable signal; this maps the ones that matter and falls back to
 * `CAMERA_UNSUPPORTED` for the rest.
 */
export function cameraErrorFrom(err: unknown): URScannerError {
	const name = typeof err === 'object' && err && 'name' in err ? String((err as { name: unknown }).name) : '';
	switch (name) {
		case 'NotAllowedError':
		case 'SecurityError':
			return new URScannerError('CAMERA_PERMISSION_DENIED', 'Camera access was denied.', err);
		case 'NotFoundError':
		case 'DevicesNotFoundError':
		case 'OverconstrainedError':
			return new URScannerError('CAMERA_NOT_FOUND', 'No matching camera device was found.', err);
		default:
			return new URScannerError('CAMERA_UNSUPPORTED', 'The camera could not be started.', err);
	}
}
