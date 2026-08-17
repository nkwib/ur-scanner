/**
 * The QR-detection seam. The decode core never talks to a camera or a decoder
 * directly: it consumes strings. This module turns pixels into strings, with a
 * pluggable {@link QRDetector} so callers (and tests) can supply their own.
 *
 * Resolution order used by {@link resolveDetector}:
 *   1. a detector you passed explicitly (tests, custom engines);
 *   2. the browser-native `BarcodeDetector` when it supports `qr_code`;
 *   3. a lazily `import()`ed `jsqr` fallback (optional peer dependency).
 *
 * Keeping the fallback lazy is deliberate: the core stays dependency-light and
 * apps that only target Chromium/Android never ship `jsqr`.
 */
import { URScannerError } from '../errors.js';

/** One detected code. Mirrors the native `DetectedBarcode` shape we rely on. */
export interface DetectedCode {
	rawValue: string;
}

/** Anything that can turn rendered pixels into decoded QR strings. */
export interface QRDetector {
	/**
	 * Decode every QR code visible in `source`. The parameter is a
	 * `CanvasImageSource`, which covers a canvas, a live `<video>`, an `<img>`
	 * and an `ImageBitmap`. It was `HTMLCanvasElement` before 0.2.0; the widening
	 * is source compatible, and a detector that only handles a canvas keeps
	 * being handed one (see {@link QRDetector.acceptsVideo}).
	 */
	detect(source: CanvasImageSource): Promise<DetectedCode[]>;
	/**
	 * Set this when `detect` can read a live `<video>` element directly. The
	 * camera loop then skips its canvas entirely, which is one full-resolution
	 * copy less per scan. Leave it unset (the default) and the loop paints a
	 * canvas first, exactly as it always has.
	 */
	readonly acceptsVideo?: boolean;
}

/** Options for the `jsqr`-backed fallback. */
export interface FallbackDetectorOptions {
	/**
	 * Cap the longer edge, in pixels, before decoding. `jsqr` walks every pixel
	 * on the main thread, so cost scales with area: a 1080p frame measures about
	 * 2x a 960px one. Downscaling also throws away camera pixels per QR module,
	 * so this trades speed against how tightly a code can be framed and still
	 * read. Unset means decode at the source resolution.
	 */
	maxSize?: number;
}

interface NativeBarcodeDetector {
	detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface NativeBarcodeDetectorCtor {
	new (options?: { formats?: string[] }): NativeBarcodeDetector;
	getSupportedFormats?(): Promise<string[]>;
}

/** Width and height of any `CanvasImageSource`, whatever it happens to be. */
function sourceSize(source: CanvasImageSource): { width: number; height: number } {
	const s = source as {
		videoWidth?: number;
		videoHeight?: number;
		naturalWidth?: number;
		naturalHeight?: number;
		width?: number;
		height?: number;
	};
	return {
		width: s.videoWidth || s.naturalWidth || (typeof s.width === 'number' ? s.width : 0),
		height: s.videoHeight || s.naturalHeight || (typeof s.height === 'number' ? s.height : 0)
	};
}

function isCanvas(source: CanvasImageSource): source is HTMLCanvasElement {
	return typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement;
}

/**
 * A {@link QRDetector} backed by the platform `BarcodeDetector`, or `null` when
 * the API is absent. Availability of the *format* is verified lazily on first
 * `detect`, because `getSupportedFormats` is async.
 *
 * @example
 * ```ts
 * const detector = nativeDetector() ?? (await fallbackDetector());
 * const codes = await detector.detect(videoElement);
 * ```
 */
export function nativeDetector(): QRDetector | null {
	const Ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector;
	if (!Ctor) return null;
	let impl: NativeBarcodeDetector | null = null;
	let checked = false;
	return {
		// The platform API takes any CanvasImageSource, so the camera loop can
		// hand it the video element and skip painting a canvas altogether.
		acceptsVideo: true,
		async detect(source) {
			if (!checked) {
				checked = true;
				const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
				if (!formats.includes('qr_code')) {
					throw new URScannerError('DETECTOR_UNSUPPORTED', 'BarcodeDetector lacks qr_code support.');
				}
				impl = new Ctor({ formats: ['qr_code'] });
			}
			const codes = await impl!.detect(source);
			return codes.map((c) => ({ rawValue: c.rawValue }));
		}
	};
}

/**
 * A {@link QRDetector} backed by the `jsqr` package, imported on demand. Throws
 * `DETECTOR_UNSUPPORTED` with an install hint when the optional dependency is
 * not present.
 *
 * @example
 * ```ts
 * // Decode at most 960px on the long edge: about 2x faster on a 1080p frame.
 * const detector = await fallbackDetector({ maxSize: 960 });
 * ```
 */
export async function fallbackDetector(options: FallbackDetectorOptions = {}): Promise<QRDetector> {
	let jsQR: (data: Uint8ClampedArray, w: number, h: number) => { data: string } | null;
	try {
		const mod = (await import('jsqr')) as {
			default?: typeof jsQR;
		} & { [k: string]: unknown };
		jsQR = (mod.default ?? (mod as unknown as typeof jsQR)) as typeof jsQR;
	} catch (err) {
		throw new URScannerError(
			'DETECTOR_UNSUPPORTED',
			'No native BarcodeDetector and the optional `jsqr` fallback is not installed. Run: npm i jsqr',
			err
		);
	}

	// One scratch canvas for the whole detector's life: allocating a new backing
	// store per scan is exactly the cost this path cannot afford.
	let scratch: HTMLCanvasElement | null = null;
	let scratchCtx: CanvasRenderingContext2D | null = null;

	return {
		// jsqr needs ImageData, not a video, but it can get there itself with one
		// downscaling copy, which is cheaper than the full-resolution copy the
		// camera loop would otherwise make first.
		acceptsVideo: true,
		async detect(source) {
			const { width, height } = sourceSize(source);
			if (width === 0 || height === 0) return [];
			const max = options.maxSize ?? 0;
			const scale = max > 0 ? Math.min(1, max / Math.max(width, height)) : 1;

			let image: ImageData;
			if (scale === 1 && isCanvas(source)) {
				// A still-image caller already painted exactly the pixels we want.
				const ctx = source.getContext('2d', { willReadFrequently: true });
				if (!ctx) throw new URScannerError('DETECTOR_UNSUPPORTED', '2D canvas context unavailable.');
				image = ctx.getImageData(0, 0, width, height);
			} else {
				const w = Math.max(1, Math.round(width * scale));
				const h = Math.max(1, Math.round(height * scale));
				scratch ??= document.createElement('canvas');
				scratchCtx ??= scratch.getContext('2d', { willReadFrequently: true });
				if (!scratchCtx) throw new URScannerError('DETECTOR_UNSUPPORTED', '2D canvas context unavailable.');
				// Assigning width or height drops the backing store, so only do it
				// when the size genuinely changed.
				if (scratch.width !== w || scratch.height !== h) {
					scratch.width = w;
					scratch.height = h;
				}
				scratchCtx.drawImage(source, 0, 0, w, h);
				image = scratchCtx.getImageData(0, 0, w, h);
			}

			const found = jsQR(image.data, image.width, image.height);
			return found ? [{ rawValue: found.data }] : [];
		}
	};
}

/**
 * Pick a detector: explicit > native > lazy fallback. `options` only reaches the
 * lazy fallback; an explicit detector and the native one are used as they are.
 *
 * @example
 * ```ts
 * const detector = await resolveDetector(undefined, { maxSize: 960 });
 * ```
 */
export async function resolveDetector(
	explicit?: QRDetector,
	options: FallbackDetectorOptions = {}
): Promise<QRDetector> {
	if (explicit) return explicit;
	return nativeDetector() ?? (await fallbackDetector(options));
}
