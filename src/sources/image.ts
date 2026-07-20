/**
 * The no-camera path: decode QR codes out of a still image (a screenshot, a
 * saved photo, an `<input type="file">` upload). Draws the source to a canvas
 * once and runs the detector over it. Multi-part payloads work by calling this
 * repeatedly with the same `receiver` across several screenshots. See
 * `docs/howto/file-and-image-input.md`.
 */
import { URReceiver } from '../receiver.js';
import { resolveDetector, type QRDetector } from './detector.js';
import type { Progress, URReceiverOptions } from '../types.js';

/** Any still-image source the browser can paint onto a canvas. */
export type ImageSource = Blob | ImageBitmap | HTMLImageElement | HTMLCanvasElement | string;

export interface ImageSourceOptions extends URReceiverOptions {
	receiver?: URReceiver;
	/** Override detection (defaults to native BarcodeDetector, then jsqr). */
	detector?: QRDetector;
	/** Cap the canvas' larger side to keep detection fast on huge photos. */
	maxSize?: number;
}

async function toBitmap(source: ImageSource): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
	if (typeof source === 'string') {
		const res = await fetch(source);
		source = await res.blob();
	}
	if (typeof Blob !== 'undefined' && source instanceof Blob) {
		const bitmap = await createImageBitmap(source);
		return { width: bitmap.width, height: bitmap.height, draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h) };
	}
	const el = source as ImageBitmap | HTMLImageElement | HTMLCanvasElement;
	const width = 'naturalWidth' in el ? el.naturalWidth || el.width : el.width;
	const height = 'naturalHeight' in el ? el.naturalHeight || el.height : el.height;
	return { width, height, draw: (ctx, w, h) => ctx.drawImage(el as CanvasImageSource, 0, 0, w, h) };
}

/**
 * Decode every QR code found in one image and feed them into a receiver.
 *
 * @returns the receiver (reusable for the next screenshot) and current progress.
 * @example
 * ```ts
 * const input = document.querySelector('input[type=file]')!;
 * const rx = new URReceiver();
 * for (const file of input.files) await fromImage(file, { receiver: rx });
 * ```
 */
export async function fromImage(
	source: ImageSource,
	options: ImageSourceOptions = {}
): Promise<{ receiver: URReceiver; progress: Progress; found: string[] }> {
	const receiver = options.receiver ?? new URReceiver(options);
	const detector = await resolveDetector(options.detector);
	const { width, height, draw } = await toBitmap(source);

	const max = options.maxSize ?? 2000;
	const scale = Math.min(1, max / Math.max(width, height || 1));
	const w = Math.max(1, Math.round(width * scale));
	const h = Math.max(1, Math.round(height * scale));

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	draw(ctx, w, h);

	const codes = await detector.detect(canvas);
	const found = codes.map((c) => c.rawValue);
	let progress = receiver.progress;
	for (const value of found) progress = receiver.addPart(value);
	return { receiver, progress, found };
}
