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

/** Anything that can turn a rendered canvas into decoded QR strings. */
export interface QRDetector {
	detect(canvas: HTMLCanvasElement): Promise<DetectedCode[]>;
}

interface NativeBarcodeDetector {
	detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface NativeBarcodeDetectorCtor {
	new (options?: { formats?: string[] }): NativeBarcodeDetector;
	getSupportedFormats?(): Promise<string[]>;
}

/**
 * A {@link QRDetector} backed by the platform `BarcodeDetector`, or `null` when
 * the API is absent. Availability of the *format* is verified lazily on first
 * `detect`, because `getSupportedFormats` is async.
 */
export function nativeDetector(): QRDetector | null {
	const Ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector;
	if (!Ctor) return null;
	let impl: NativeBarcodeDetector | null = null;
	let checked = false;
	return {
		async detect(canvas) {
			if (!checked) {
				checked = true;
				const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
				if (!formats.includes('qr_code')) {
					throw new URScannerError('DETECTOR_UNSUPPORTED', 'BarcodeDetector lacks qr_code support.');
				}
				impl = new Ctor({ formats: ['qr_code'] });
			}
			const codes = await impl!.detect(canvas);
			return codes.map((c) => ({ rawValue: c.rawValue }));
		}
	};
}

/**
 * A {@link QRDetector} backed by the `jsqr` package, imported on demand. Throws
 * `DETECTOR_UNSUPPORTED` with an install hint when the optional dependency is
 * not present.
 */
export async function fallbackDetector(): Promise<QRDetector> {
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
	return {
		async detect(canvas) {
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) throw new URScannerError('DETECTOR_UNSUPPORTED', '2D canvas context unavailable.');
			const { width, height } = canvas;
			if (width === 0 || height === 0) return [];
			const image = ctx.getImageData(0, 0, width, height);
			const found = jsQR(image.data, width, height);
			return found ? [{ rawValue: found.data }] : [];
		}
	};
}

/** Pick a detector: explicit > native > lazy fallback. */
export async function resolveDetector(explicit?: QRDetector): Promise<QRDetector> {
	if (explicit) return explicit;
	return nativeDetector() ?? (await fallbackDetector());
}
