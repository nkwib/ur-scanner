import { beforeAll, describe, expect, it } from 'vitest';
import { fromImage } from '../src/sources/image.js';
import { nativeDetector, resolveDetector, type QRDetector } from '../src/sources/detector.js';
import { loadFixture } from './helpers.js';

const multi = loadFixture('bytes.multipart.json');

/** A detector that ignores pixels and replays a scripted queue of results. */
function stubDetector(queue: string[][]): QRDetector {
	let i = 0;
	return { async detect() { return (queue[i++] ?? []).map((rawValue) => ({ rawValue })); } };
}

beforeAll(() => {
	// jsdom ships no canvas raster backend; stub just enough for the draw path.
	// The stub detector never reads pixels, so this only needs to not throw.
	HTMLCanvasElement.prototype.getContext = function () {
		return {
			drawImage() {},
			getImageData() {
				return { data: new Uint8ClampedArray(4), width: 1, height: 1 };
			}
		} as unknown as CanvasRenderingContext2D;
	} as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('detector seam', () => {
	it('nativeDetector() is null when BarcodeDetector is absent (jsdom)', () => {
		expect(nativeDetector()).toBeNull();
	});

	it('resolveDetector prefers an explicitly provided detector', async () => {
		const explicit = stubDetector([['ur:bytes/1-1/x']]);
		expect(await resolveDetector(explicit)).toBe(explicit);
	});
});

describe('fromImage', () => {
	it('feeds every QR found in an image into the receiver', async () => {
		const img = document.createElement('img');
		Object.defineProperty(img, 'naturalWidth', { value: 64 });
		Object.defineProperty(img, 'naturalHeight', { value: 64 });
		const { found, progress } = await fromImage(img, {
			detector: stubDetector([[multi.parts[0]!]])
		});
		expect(found).toEqual([multi.parts[0]]);
		expect(progress.type).toBe('bytes');
		expect(progress.framesSeen).toBe(1);
	});

	it('completes a multipart payload across several screenshots (shared receiver)', async () => {
		const img = document.createElement('img');
		Object.defineProperty(img, 'naturalWidth', { value: 64 });
		Object.defineProperty(img, 'naturalHeight', { value: 64 });
		const detector = stubDetector(multi.parts.map((p) => [p]));
		let receiver;
		let progress;
		for (let i = 0; i < multi.parts.length; i++) {
			const r = await fromImage(img, { detector, receiver });
			receiver = r.receiver;
			progress = r.progress;
			if (progress.complete) break;
		}
		expect(progress!.complete).toBe(true);
	});
});
