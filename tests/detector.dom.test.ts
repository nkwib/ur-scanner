import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fallbackDetector, resolveDetector, type QRDetector } from '../src/sources/detector.js';

/**
 * jsdom has no canvas raster backend, so these record the *plumbing*: what size
 * the fallback rasterises at and whether it copies at all. jsqr itself is
 * exercised for real against camera frames in `bench/camera.mjs` and by the
 * Playwright camera spec.
 */
interface Painted {
	width: number;
	height: number;
}

let painted: Painted[] = [];
let imageDataCalls: Painted[] = [];

function stubContext(): CanvasRenderingContext2D {
	return {
		drawImage(_source: unknown, _x: number, _y: number, width: number, height: number) {
			painted.push({ width, height });
		},
		getImageData(_x: number, _y: number, width: number, height: number) {
			imageDataCalls.push({ width, height });
			return { data: new Uint8ClampedArray(width * height * 4), width, height };
		}
	} as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
	painted = [];
	imageDataCalls = [];
	vi.restoreAllMocks();
	HTMLCanvasElement.prototype.getContext = function () {
		return stubContext();
	} as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

/** A stand-in for a 1080p camera frame. */
function fakeVideo(width = 1920, height = 1080): HTMLVideoElement {
	const video = document.createElement('video');
	Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
	Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
	return video;
}

describe('fallbackDetector', () => {
	it('accepts a video source directly', async () => {
		const detector = await fallbackDetector();
		expect(detector.acceptsVideo).toBe(true);
	});

	it('caps the long edge at maxSize before decoding', async () => {
		const detector = await fallbackDetector({ maxSize: 960 });
		await detector.detect(fakeVideo());
		// 1920x1080 scaled by 960/1920: a quarter of the pixels jsqr must walk.
		expect(painted).toEqual([{ width: 960, height: 540 }]);
		expect(imageDataCalls).toEqual([{ width: 960, height: 540 }]);
	});

	it('never upscales a source smaller than maxSize', async () => {
		const detector = await fallbackDetector({ maxSize: 960 });
		await detector.detect(fakeVideo(640, 480));
		expect(painted).toEqual([{ width: 640, height: 480 }]);
	});

	it('reuses one scratch canvas across scans', async () => {
		const created = vi.spyOn(document, 'createElement');
		const detector = await fallbackDetector({ maxSize: 960 });
		const video = fakeVideo();
		await detector.detect(video);
		await detector.detect(video);
		await detector.detect(video);
		expect(created.mock.calls.filter(([tag]) => tag === 'canvas')).toHaveLength(1);
	});

	it('reads a canvas source in place when no cap is set (the still-image path)', async () => {
		const detector = await fallbackDetector();
		const canvas = document.createElement('canvas');
		canvas.width = 1600;
		canvas.height = 1200;
		const created = vi.spyOn(document, 'createElement');
		await detector.detect(canvas);
		// No copy: fromImage already painted exactly the pixels wanted, and
		// downscaling a still would cost decodability for no throughput gain.
		expect(painted).toEqual([]);
		expect(imageDataCalls).toEqual([{ width: 1600, height: 1200 }]);
		expect(created.mock.calls.filter(([tag]) => tag === 'canvas')).toHaveLength(0);
	});

	it('returns nothing for a zero-sized source instead of throwing', async () => {
		const detector = await fallbackDetector({ maxSize: 960 });
		expect(await detector.detect(fakeVideo(0, 0))).toEqual([]);
	});
});

describe('resolveDetector', () => {
	it('prefers an explicit detector and ignores fallback options', async () => {
		const explicit: QRDetector = { async detect() { return []; } };
		expect(await resolveDetector(explicit, { maxSize: 100 })).toBe(explicit);
	});

	it('falls back to jsqr when no native detector exists (jsdom)', async () => {
		const detector = await resolveDetector(undefined, { maxSize: 640 });
		await detector.detect(fakeVideo());
		expect(painted).toEqual([{ width: 640, height: 360 }]);
	});
});
