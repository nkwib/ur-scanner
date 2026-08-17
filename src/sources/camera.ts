/**
 * The live camera source. Opens a stream, runs a detect loop, and feeds every
 * decoded string into a {@link URReceiver}. Returns a controller so callers can
 * stop it, toggle the torch, and switch cameras.
 *
 * The loop runs once per *delivered camera frame* via `requestVideoFrameCallback`,
 * falling back to `requestAnimationFrame` where that is missing. Animated QR is
 * a throughput problem: every frame the sender displays and the loop does not
 * look at is a frame of payload thrown away, so the scan rate wants to track the
 * camera rather than a fixed timer. `scanIntervalMs` is still there as an
 * explicit cap for battery. See `docs/howto/tuning.md`.
 *
 * Ergonomics ported from the parent app's field-tested scanner: default to the
 * environment-facing camera and keep the video element caller-owned so layout
 * stays flexible. See `docs/howto/camera-selection-and-torch.md`.
 */
import { URReceiver } from '../receiver.js';
import { cameraErrorFrom, URScannerError } from '../errors.js';
import { resolveDetector, type QRDetector } from './detector.js';
import type { URReceiverOptions } from '../types.js';

/**
 * `requestAnimationFrame` fires at the display's rate, often 60 to 120 Hz, no
 * matter how fast the camera is actually supplying frames. Scanning on every one
 * of them mostly re-reads a frame that was already scanned, so the path without
 * `requestVideoFrameCallback` gets capped near the fastest rate a camera
 * realistically delivers.
 */
const RAF_SCAN_INTERVAL_MS = 33;

/**
 * Default long-edge cap for the `jsqr` fallback. Measured on 1080p frames it is
 * about 2x faster than decoding at source resolution, and it still leaves enough
 * camera pixels per QR module to read a tightly framed code. Below roughly this
 * size, decoding starts failing before it gets meaningfully faster.
 */
const FALLBACK_MAX_SIZE = 960;

export interface CameraSourceOptions extends URReceiverOptions {
	/** Video element to render the preview into. One is created if omitted. */
	video?: HTMLVideoElement;
	/** Passed to `getUserMedia`. Defaults to `{ video: { facingMode: 'environment' } }`. */
	constraints?: MediaStreamConstraints;
	/** Reuse an existing receiver (e.g. shared with a file-input fallback). */
	receiver?: URReceiver;
	/** Override detection (defaults to native BarcodeDetector, then jsqr). */
	detector?: QRDetector;
	/**
	 * Minimum ms between detect attempts. Unset scans every delivered camera
	 * frame (or every ~33ms without `requestVideoFrameCallback`). Set it to trade
	 * throughput for battery; it was 120 by default before 0.2.0.
	 */
	scanIntervalMs?: number;
	/**
	 * Long-edge cap, in pixels, applied before the `jsqr` fallback decodes.
	 * Default 960. Raise it if dense codes fail to read, lower it for speed.
	 * Ignored when a native detector or an explicit `detector` is used.
	 */
	fallbackMaxSize?: number;
}

/**
 * `requestVideoFrameCallback` is missing from some browsers (and from older TS
 * DOM libs), so it is reached through this structural view rather than by
 * retyping the element.
 */
interface FrameCallbackApi {
	requestVideoFrameCallback?(callback: (now: number) => void): number;
	cancelVideoFrameCallback?(handle: number): void;
}

export interface CameraController {
	readonly receiver: URReceiver;
	readonly video: HTMLVideoElement;
	/** Stop the loop, release the stream, and dispose the receiver's timers. */
	stop(): void;
	/** `true` if the active track advertises a `torch` capability. */
	hasTorch(): boolean;
	/** Turn the torch on/off (no-op where unsupported). */
	torch(on: boolean): Promise<void>;
	/** List available video input devices (labels require a granted permission). */
	listVideoInputs(): Promise<MediaDeviceInfo[]>;
	/** Restart the stream on a specific device (from {@link listVideoInputs}). */
	switchCamera(deviceId: string): Promise<CameraController>;
}

/** The torch bits of a video track are non-standard; type only what we touch. */
interface TorchTrack {
	getCapabilities?(): { torch?: boolean };
	applyConstraints(constraints: unknown): Promise<void>;
}

/**
 * Start scanning from the camera.
 *
 * @throws URScannerError `INSECURE_CONTEXT` when not on HTTPS/localhost,
 *   `CAMERA_UNSUPPORTED`/`CAMERA_PERMISSION_DENIED`/`CAMERA_NOT_FOUND` per the
 *   `getUserMedia` failure.
 * @example
 * ```ts
 * const cam = await fromCamera({
 *   video: document.querySelector('video')!,
 *   onComplete: (ur) => { cam.stop(); use(ur.cbor); }
 * });
 * ```
 */
export async function fromCamera(options: CameraSourceOptions = {}): Promise<CameraController> {
	if (typeof window !== 'undefined' && window.isSecureContext === false) {
		throw new URScannerError('INSECURE_CONTEXT', 'Camera access requires HTTPS or localhost.');
	}
	const media = globalThis.navigator?.mediaDevices;
	if (!media?.getUserMedia) {
		throw new URScannerError('CAMERA_UNSUPPORTED', 'getUserMedia is not available in this context.');
	}

	const receiver = options.receiver ?? new URReceiver(options);
	const detector = await resolveDetector(options.detector, {
		maxSize: options.fallbackMaxSize ?? FALLBACK_MAX_SIZE
	});
	const video = options.video ?? document.createElement('video');
	const frameApi = video as unknown as FrameCallbackApi;
	const usesFrameCallback = typeof frameApi.requestVideoFrameCallback === 'function';
	const interval = options.scanIntervalMs ?? (usesFrameCallback ? 0 : RAF_SCAN_INTERVAL_MS);

	let stream: MediaStream;
	const start = async (constraints: MediaStreamConstraints): Promise<void> => {
		try {
			stream = await media.getUserMedia(constraints);
		} catch (err) {
			throw cameraErrorFrom(err);
		}
		video.setAttribute('playsinline', 'true');
		video.muted = true;
		video.srcObject = stream;
		await video.play().catch(() => undefined);
	};

	await start(options.constraints ?? { video: { facingMode: 'environment' } });

	// Only detectors that cannot read a video need this, so it stays unallocated
	// on the native path: a full-resolution `willReadFrequently` canvas is CPU
	// backed, and painting one per scan is work the native detector never needed.
	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;
	const paintFrame = (): HTMLCanvasElement => {
		canvas ??= document.createElement('canvas');
		ctx ??= canvas.getContext('2d', { willReadFrequently: true })!;
		// Assigning width or height drops the backing store and resets context
		// state, so resize only when the camera's dimensions actually change.
		if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
		}
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		return canvas;
	};

	let running = true;
	let lastScan = 0;
	let frameHandle: number | null = null;
	let rafHandle: number | null = null;

	const schedule = (fn: (now: number) => void): void => {
		if (usesFrameCallback) frameHandle = frameApi.requestVideoFrameCallback!(fn);
		else rafHandle = requestAnimationFrame(fn);
	};
	const unschedule = (): void => {
		if (frameHandle !== null) frameApi.cancelVideoFrameCallback?.(frameHandle);
		if (rafHandle !== null) cancelAnimationFrame(rafHandle);
		frameHandle = null;
		rafHandle = null;
	};

	const tick = async (now: number): Promise<void> => {
		if (!running) return;
		if (now - lastScan >= interval && video.readyState >= 2 && video.videoWidth > 0) {
			lastScan = now;
			try {
				const codes = await detector.detect(detector.acceptsVideo ? video : paintFrame());
				for (const code of codes) {
					const progress = receiver.addPart(code.rawValue);
					if (progress.complete) {
						running = false;
						return;
					}
				}
			} catch {
				/* transient detector hiccups are non-fatal; keep scanning */
			}
		}
		// Scheduled only after the await, so a slow detector throttles itself
		// instead of queueing callbacks it cannot keep up with.
		if (running) schedule((t) => void tick(t));
	};
	schedule((t) => void tick(t));

	const track = (): TorchTrack | undefined =>
		stream.getVideoTracks()[0] as unknown as TorchTrack | undefined;

	const controller: CameraController = {
		receiver,
		video,
		stop() {
			running = false;
			unschedule();
			stream.getTracks().forEach((t) => t.stop());
			video.srcObject = null;
			receiver.dispose();
		},
		hasTorch() {
			return Boolean(track()?.getCapabilities?.().torch);
		},
		async torch(on) {
			const t = track();
			if (t?.getCapabilities?.().torch) {
				await t.applyConstraints({ advanced: [{ torch: on }] });
			}
		},
		async listVideoInputs() {
			const devices = await media.enumerateDevices();
			return devices.filter((d) => d.kind === 'videoinput');
		},
		async switchCamera(deviceId) {
			running = false;
			unschedule();
			stream.getTracks().forEach((t) => t.stop());
			await start({ video: { deviceId: { exact: deviceId } } });
			running = true;
			lastScan = 0;
			schedule((t) => void tick(t));
			return controller;
		}
	};
	return controller;
}
