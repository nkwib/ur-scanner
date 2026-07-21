/**
 * The pure decode core: zero DOM, zero timers unless you ask for one. Feed it
 * QR text with {@link URReceiver.addPart}; it owns type locking, mixed-type
 * detection, duplicate handling, progress semantics, and completion. Fountain
 * decoding and UR parsing are delegated to `@ngraveio/bc-ur` (we do not
 * reimplement the spec); this class owns everything *around* that.
 *
 * @example
 * ```ts
 * import { URReceiver } from '@nkwib/ur-scanner';
 *
 * const rx = new URReceiver({ onComplete: (ur) => console.log(ur.cbor) });
 * for (const frame of frames) {
 *   const p = rx.addPart(frame);
 *   if (p.complete) break;
 * }
 * ```
 */
import { URDecoder } from '@ngraveio/bc-ur';
import { Emitter } from './emitter.js';
import { URScannerError } from './errors.js';
import type { DecodedUR, IgnoredFrame, Progress, URReceiverEvents, URReceiverOptions } from './types.js';

/** Pull the `total` count out of a multipart UR sequence header, else `null`. */
function multipartTotal(text: string): number | null {
	const m = /^ur:[^/]+\/(\d+)-(\d+)\//i.exec(text);
	return m ? Number(m[2]) : null;
}

export class URReceiver extends Emitter<URReceiverEvents> {
	private decoder = new URDecoder();
	private options: URReceiverOptions;
	private lockedType: string | null = null;
	private multipart = false;
	private framesSeen = 0;
	private completed = false;
	private failed = false;
	private lastReceivedCount = 0;
	private stallTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(options: URReceiverOptions = {}) {
		super();
		this.options = options;
		if (options.onProgress) this.on('progress', options.onProgress);
		if (options.onComplete) this.on('complete', options.onComplete);
		if (options.onError) this.on('error', options.onError);
		if (options.onIgnore) this.on('ignore', options.onIgnore);
	}

	/** Current progress snapshot without feeding anything. */
	get progress(): Progress {
		return this.snapshot();
	}

	/** `true` once the payload is fully recovered. */
	get isComplete(): boolean {
		return this.completed;
	}

	/** The UR type once locked (after the first accepted part), else `null`. */
	get type(): string | null {
		return this.lockedType;
	}

	/**
	 * Feed one scanned QR string. Idempotent for duplicates and safe to call with
	 * noise (non-UR text, foreign types): those are counted and surfaced via the
	 * `ignore` event rather than throwing. Returns the progress *after* this frame.
	 */
	addPart(text: string): Progress {
		if (this.completed || this.failed) return this.snapshot();
		const raw = (text ?? '').trim();
		if (!raw) return this.snapshot();
		this.framesSeen++;

		let partType: string;
		try {
			[partType] = URDecoder.parse(raw);
		} catch {
			this.ignore({ reason: 'not-a-ur', text: raw });
			return this.snapshot();
		}
		partType = partType.toLowerCase();

		const expected = this.options.expectedType?.toLowerCase();
		if (expected && partType !== expected) {
			this.fail(
				new URScannerError(
					'UNEXPECTED_TYPE',
					`Expected a "${expected}" UR but scanned a "${partType}" UR.`
				)
			);
			return this.snapshot();
		}

		if (this.lockedType && partType !== this.lockedType) {
			// A foreign UR wandered into frame mid-scan. Warn, but keep decoding.
			this.emit(
				'error',
				new URScannerError(
					'MIXED_UR_TYPES',
					`Ignoring a "${partType}" UR while decoding a "${this.lockedType}" UR.`
				)
			);
			this.ignore({ reason: 'mixed-type', text: raw, seenType: partType });
			return this.snapshot();
		}

		let accepted: boolean;
		try {
			accepted = this.decoder.receivePart(raw);
		} catch (err) {
			this.ignore({ reason: 'malformed', text: raw, seenType: partType });
			void err;
			return this.snapshot();
		}

		if (this.lockedType === null && accepted) {
			this.lockedType = partType;
			if ((multipartTotal(raw) ?? 1) > 1) this.multipart = true;
		} else if ((multipartTotal(raw) ?? 1) > 1) {
			this.multipart = true;
		}

		if (this.decoder.isError()) {
			this.fail(new URScannerError('DECODE_FAILED', this.decoder.resultError()));
			return this.snapshot();
		}

		const received = this.decoder.receivedPartIndexes().length;
		if (!accepted || received === this.lastReceivedCount) {
			// bc-ur already had this fragment: a genuine duplicate frame.
			this.ignore({ reason: 'duplicate', text: raw, seenType: partType });
		} else {
			this.lastReceivedCount = received;
			this.armStall();
		}

		const progress = this.snapshot();
		this.emit('progress', progress);

		if (this.decoder.isComplete() && this.decoder.isSuccess()) {
			this.completed = true;
			this.clearStall();
			this.emit('complete', this.buildResult());
		}
		return this.snapshot();
	}

	/** Discard all state and start over (e.g. the user aims at a new code). */
	reset(): void {
		this.decoder = new URDecoder();
		this.lockedType = null;
		this.multipart = false;
		this.framesSeen = 0;
		this.completed = false;
		this.failed = false;
		this.lastReceivedCount = 0;
		this.clearStall();
	}

	/** Release the stall timer and all listeners. Call when tearing down. */
	dispose(): void {
		this.clearStall();
		this.clearListeners();
	}

	private buildResult(): DecodedUR {
		const ur = this.decoder.resultUR();
		return {
			type: ur.type,
			cbor: new Uint8Array(ur.cbor),
			wasSinglePart: !this.multipart,
			decodeCbor: () => ur.decodeCBOR()
		};
	}

	private snapshot(): Progress {
		const estimate = this.decoder.estimatedPercentComplete();
		return {
			type: this.lockedType,
			receivedParts: this.decoder.receivedPartIndexes().length,
			expectedPartCount: this.decoder.expectedPartCount(),
			estimatedPercent: this.completed ? 1 : Math.max(0, Math.min(1, estimate)),
			framesSeen: this.framesSeen,
			canStartAnywhere: true,
			complete: this.completed
		};
	}

	private ignore(info: IgnoredFrame): void {
		this.emit('ignore', { ...info, text: info.text.slice(0, 48) });
	}

	private fail(error: URScannerError): void {
		this.failed = true;
		this.clearStall();
		this.emit('error', error);
	}

	private armStall(): void {
		const ms = this.options.stallTimeoutMs;
		if (!ms || ms <= 0) return;
		this.clearStall();
		this.stallTimer = setTimeout(() => {
			if (!this.completed && !this.failed) {
				this.emit(
					'error',
					new URScannerError(
						'DECODE_STALL',
						`No new part received in ${ms}ms (${this.snapshot().receivedParts}/${this.snapshot().expectedPartCount} parts).`
					)
				);
			}
		}, ms);
		// Do not keep a Node process alive purely for the watchdog.
		(this.stallTimer as { unref?: () => void }).unref?.();
	}

	private clearStall(): void {
		if (this.stallTimer !== null) {
			clearTimeout(this.stallTimer);
			this.stallTimer = null;
		}
	}
}
