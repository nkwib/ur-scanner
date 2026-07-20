/**
 * The live camera source. Opens a stream, runs a detect loop against a hidden
 * canvas, and feeds every decoded string into a {@link URReceiver}. Returns a
 * controller so callers can stop it, toggle the torch, and switch cameras.
 *
 * Ergonomics ported from the parent app's field-tested scanner: default to the
 * environment-facing camera, throttle detection independently of the display
 * frame rate, and keep the video element caller-owned so layout stays flexible.
 * See `docs/howto/camera-selection-and-torch.md` and `docs/howto/tuning.md`.
 */
import { URReceiver } from '../receiver.js';
import { cameraErrorFrom, URScannerError } from '../errors.js';
import { resolveDetector, type QRDetector } from './detector.js';
import type { URReceiverOptions } from '../types.js';

export interface CameraSourceOptions extends URReceiverOptions {
	/** Video element to render the preview into. One is created if omitted. */
	video?: HTMLVideoElement;
	/** Passed to `getUserMedia`. Defaults to `{ video: { facingMode: 'environment' } }`. */
	constraints?: MediaStreamConstraints;
	/** Reuse an existing receiver (e.g. shared with a file-input fallback). */
	receiver?: URReceiver;
	/** Override detection (defaults to native BarcodeDetector, then jsqr). */
	detector?: QRDetector;
	/** Minimum ms between detect attempts. Default 120 (~8 scans/s). */
	scanIntervalMs?: number;
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
	const detector = await resolveDetector(options.detector);
	const video = options.video ?? document.createElement('video');
	const interval = options.scanIntervalMs ?? 120;

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

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	let running = true;
	let lastScan = 0;

	const tick = async (now: number): Promise<void> => {
		if (!running) return;
		if (now - lastScan >= interval && video.readyState >= 2 && video.videoWidth > 0) {
			lastScan = now;
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			try {
				const codes = await detector.detect(canvas);
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
		if (running) requestAnimationFrame((t) => void tick(t));
	};
	requestAnimationFrame((t) => void tick(t));

	const track = (): TorchTrack | undefined =>
		stream.getVideoTracks()[0] as unknown as TorchTrack | undefined;

	const controller: CameraController = {
		receiver,
		video,
		stop() {
			running = false;
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
			stream.getTracks().forEach((t) => t.stop());
			await start({ video: { deviceId: { exact: deviceId } } });
			running = true;
			lastScan = 0;
			requestAnimationFrame((t) => void tick(t));
			return controller;
		}
	};
	return controller;
}
