import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fromCamera } from '../src/sources/camera.js';
import type { DetectedCode, QRDetector } from '../src/sources/detector.js';
import { loadFixture } from './helpers.js';

const multi = loadFixture('bytes.multipart.json');

/**
 * A detector typed exactly the way one written against 0.1.x would be: the
 * parameter is `HTMLCanvasElement`, not the widened `CanvasImageSource`. This
 * has to keep compiling, so `pnpm typecheck` is half of this test.
 */
const legacyDetector: QRDetector = {
	async detect(canvas: HTMLCanvasElement): Promise<DetectedCode[]> {
		seenSources.push(canvas);
		return [{ rawValue: nextPart() }];
	}
};

let seenSources: unknown[] = [];
let partIndex = 0;
const nextPart = () => multi.parts[partIndex++ % multi.parts.length]!;

function fakeStream(): MediaStream {
	const track = {
		kind: 'video',
		stop: () => {},
		getCapabilities: () => ({}),
		applyConstraints: async () => {}
	};
	return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
}

/** A video element that claims to be playing 1280x720 frames. */
function fakeVideo(): HTMLVideoElement {
	const video = document.createElement('video');
	Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
	Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
	Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
	return video;
}

/** Let the animation-frame loop run until `predicate` holds, or time out. */
async function until(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) throw new Error('timed out waiting for the scan loop');
		await new Promise((r) => setTimeout(r, 5));
	}
}

beforeAll(() => {
	Object.defineProperty(globalThis.navigator, 'mediaDevices', {
		configurable: true,
		value: { getUserMedia: async () => fakeStream(), enumerateDevices: async () => [] }
	});
	HTMLMediaElement.prototype.play = async () => undefined;
	// jsdom ships no canvas raster backend; the stub detectors never read pixels.
	HTMLCanvasElement.prototype.getContext = function () {
		return { drawImage() {} } as unknown as CanvasRenderingContext2D;
	} as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
	seenSources = [];
	partIndex = 0;
	vi.restoreAllMocks();
});

describe('fromCamera scan loop', () => {
	it('hands the video straight to a detector that accepts one', async () => {
		const video = fakeVideo();
		const detector: QRDetector = {
			acceptsVideo: true,
			async detect(source) {
				seenSources.push(source);
				return [];
			}
		};
		const createElement = vi.spyOn(document, 'createElement');

		const cam = await fromCamera({ video, detector });
		await until(() => seenSources.length > 0);
		cam.stop();

		expect(seenSources[0]).toBe(video);
		// No canvas at all on this path: that is the point of the widened seam.
		expect(createElement.mock.calls.filter(([tag]) => tag === 'canvas')).toHaveLength(0);
	});

	it('still paints a canvas for a detector that does not accept a video', async () => {
		const video = fakeVideo();
		const cam = await fromCamera({ video, detector: legacyDetector });
		await until(() => seenSources.length > 0);
		cam.stop();

		expect(seenSources[0]).toBeInstanceOf(HTMLCanvasElement);
		const canvas = seenSources[0] as HTMLCanvasElement;
		expect(canvas.width).toBe(1280);
		expect(canvas.height).toBe(720);
	});

	it('resizes that canvas once, not once per scan', async () => {
		const video = fakeVideo();
		let resizes = 0;
		const canvasProto = HTMLCanvasElement.prototype;
		const original = Object.getOwnPropertyDescriptor(canvasProto, 'width')!;
		Object.defineProperty(canvasProto, 'width', {
			configurable: true,
			get() {
				return this.__w ?? 0;
			},
			set(value: number) {
				resizes++;
				this.__w = value;
			}
		});
		try {
			const cam = await fromCamera({ video, detector: legacyDetector });
			await until(() => seenSources.length >= 5);
			cam.stop();
		} finally {
			Object.defineProperty(canvasProto, 'width', original);
		}
		expect(seenSources.length).toBeGreaterThanOrEqual(5);
		expect(resizes).toBe(1);
	});

	it('decodes a payload through the loop and reports completion', async () => {
		const video = fakeVideo();
		let completedBytes = -1;
		const cam = await fromCamera({
			video,
			detector: legacyDetector,
			onComplete: (ur) => (completedBytes = ur.cbor.length)
		});
		await until(() => completedBytes >= 0, 5000);
		cam.stop();
		expect(completedBytes).toBeGreaterThan(0);
	});

	it('honours scanIntervalMs as an explicit cap', async () => {
		const video = fakeVideo();
		const detector: QRDetector = {
			acceptsVideo: true,
			async detect() {
				seenSources.push(Date.now());
				return [];
			}
		};
		const cam = await fromCamera({ video, detector, scanIntervalMs: 200 });
		await new Promise((r) => setTimeout(r, 450));
		cam.stop();
		// ~450ms at one scan per 200ms is 2 or 3, nowhere near a frame-rate loop.
		expect(seenSources.length).toBeLessThanOrEqual(4);
		expect(seenSources.length).toBeGreaterThan(0);
	});

	it('stops scanning after stop()', async () => {
		const video = fakeVideo();
		const detector: QRDetector = {
			acceptsVideo: true,
			async detect() {
				seenSources.push(1);
				return [];
			}
		};
		const cam = await fromCamera({ video, detector });
		await until(() => seenSources.length > 0);
		cam.stop();
		const afterStop = seenSources.length;
		await new Promise((r) => setTimeout(r, 100));
		expect(seenSources.length).toBe(afterStop);
	});
});
