/**
 * Browser half of the camera benchmark. Loaded into Chromium by
 * `bench/camera.mjs` against a fake camera device, and exposes two scenarios on
 * `window.__bench`:
 *
 *   e2e     the real `fromCamera()` loop run to completion: wall clock, frames
 *           seen, and how many times the detector was actually asked to look.
 *   stages  a micro-benchmark of each per-scan pipeline stage in isolation, so
 *           an end-to-end delta can be attributed to a specific line of code
 *           instead of guessed at.
 */
import jsQR from 'jsqr';
import { fallbackDetector, fromCamera, nativeDetector, resolveDetector, URReceiver } from '../src/index.ts';

const video = () => document.getElementById('v');

/**
 * Open a stream for the micro-benchmarks and leave it running. Unconstrained on
 * purpose: the fake device then delivers the Y4M file's own resolution, so a
 * 1080p fixture is measured at 1080p rather than being quietly downscaled by a
 * constraint the benchmark asked for.
 */
async function liveVideo(constraints = { video: true }) {
	const v = video();
	if (v.srcObject) return v;
	const stream = await navigator.mediaDevices.getUserMedia(constraints);
	v.srcObject = stream;
	await v.play();
	// Wait for real pixels: videoWidth is 0 until the first frame is decoded.
	while (v.readyState < 2 || v.videoWidth === 0) await new Promise((r) => setTimeout(r, 20));
	return v;
}

function stats(samples) {
	const sorted = [...samples].sort((a, b) => a - b);
	const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
	return {
		median: Number(at(0.5).toFixed(3)),
		p95: Number(at(0.95).toFixed(3)),
		mean: Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(3))
	};
}

/**
 * Time `fn` once per delivered camera frame, so every sample sees new pixels
 * rather than re-measuring one cached frame the GPU has already uploaded.
 */
async function perFrame(v, iterations, fn) {
	const samples = [];
	let decoded = 0;
	for (let i = 0; i < iterations; i++) {
		await new Promise((r) => v.requestVideoFrameCallback(() => r()));
		const started = performance.now();
		const hit = await fn(v);
		samples.push(performance.now() - started);
		if (hit) decoded++;
	}
	return { ...stats(samples), decoded, iterations };
}

window.__bench = {
	env() {
		const v = video();
		return {
			barcodeDetector: typeof BarcodeDetector !== 'undefined',
			nativeDetector: nativeDetector() !== null,
			requestVideoFrameCallback: 'requestVideoFrameCallback' in HTMLVideoElement.prototype,
			videoSize: v?.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : null,
			userAgent: navigator.userAgent
		};
	},

	/**
	 * Run the real camera loop until the payload completes or `timeoutMs` passes.
	 * `useFallback` forces the jsqr path even where a native detector exists, so
	 * the Safari/Firefox story is measured rather than assumed.
	 */
	async e2e({ timeoutMs = 30000, useFallback = false, ...options } = {}) {
		const inner = useFallback ? await fallbackDetector() : await resolveDetector();
		let scans = 0;
		const counting = {
			acceptsVideo: inner.acceptsVideo,
			detect(source) {
				scans++;
				return inner.detect(source);
			}
		};

		const receiver = new URReceiver();
		const started = performance.now();
		return await new Promise((resolve) => {
			let cam = null;
			const finish = (complete) => {
				const ms = performance.now() - started;
				const p = receiver.progress;
				cam?.stop();
				resolve({
					complete,
					ms: Number(ms.toFixed(1)),
					scans,
					scansPerSec: Number(((scans / ms) * 1000).toFixed(2)),
					framesSeen: p.framesSeen,
					receivedParts: p.receivedParts,
					expectedPartCount: p.expectedPartCount,
					videoSize: `${video().videoWidth}x${video().videoHeight}`
				});
			};
			const timer = setTimeout(() => finish(false), timeoutMs);
			receiver.on('complete', () => {
				clearTimeout(timer);
				finish(true);
			});
			fromCamera({ video: video(), receiver, detector: counting, ...options }).then(
				(c) => (cam = c),
				(err) => resolve({ error: String(err?.message ?? err) })
			);
		});
	},

	/**
	 * Cost of the canvas work alone, in a tight loop rather than one sample per
	 * delivered frame. Reassigning `canvas.width` drops the backing store, so
	 * this is where candidate 2 either shows up or does not.
	 */
	async canvasCost({ iterations = 400 } = {}) {
		const v = await liveVideo();
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		const tight = (fn) => {
			for (let i = 0; i < 50; i++) fn(); // warm up
			const samples = [];
			for (let r = 0; r < 5; r++) {
				const started = performance.now();
				for (let i = 0; i < iterations; i++) fn();
				samples.push((performance.now() - started) / iterations);
			}
			return stats(samples);
		};
		return {
			videoSize: `${v.videoWidth}x${v.videoHeight}`,
			resizeAndDraw: tight(() => {
				canvas.width = v.videoWidth;
				canvas.height = v.videoHeight;
				ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
			}),
			drawOnly: tight(() => {
				if (canvas.width !== v.videoWidth) canvas.width = v.videoWidth;
				if (canvas.height !== v.videoHeight) canvas.height = v.videoHeight;
				ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
			})
		};
	},

	/** Per-scan cost of each detect strategy, one sample per delivered frame. */
	async stages({ iterations = 60 } = {}) {
		const v = await liveVideo();
		const native = nativeDetector();
		const out = { videoSize: `${v.videoWidth}x${v.videoHeight}`, iterations };

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });

		if (native) {
			// Exactly what the library does today: resize, paint, detect the canvas.
			out.nativeViaCanvas = await perFrame(v, iterations, async (vid) => {
				canvas.width = vid.videoWidth;
				canvas.height = vid.videoHeight;
				ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
				return (await native.detect(canvas)).length > 0;
			});
			// Candidate 1: hand the video straight to the detector, no copy at all.
			out.nativeVideoDirect = await perFrame(v, iterations, async (vid) =>
				(await native.detect(vid)).length > 0
			);
		}

		// jsqr at full capture resolution (today's fallback) vs downscaled
		// (candidate 4). `decoded` is the honest half: a downscale that is faster
		// but stops reading the code is not an optimization.
		canvas.width = v.videoWidth;
		canvas.height = v.videoHeight;
		out.jsqrFull = await perFrame(v, iterations, (vid) => {
			ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
			const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
			return jsQR(image.data, canvas.width, canvas.height) !== null;
		});

		const scratch = document.createElement('canvas');
		const sctx = scratch.getContext('2d', { willReadFrequently: true });
		for (const maxEdge of [960, 800, 640, 480, 320]) {
			out[`jsqrScaled${maxEdge}`] = await perFrame(v, iterations, (vid) => {
				const scale = Math.min(1, maxEdge / Math.max(vid.videoWidth, vid.videoHeight));
				const w = Math.round(vid.videoWidth * scale);
				const h = Math.round(vid.videoHeight * scale);
				if (scratch.width !== w || scratch.height !== h) {
					scratch.width = w;
					scratch.height = h;
				}
				sctx.drawImage(vid, 0, 0, w, h);
				const image = sctx.getImageData(0, 0, w, h);
				return jsQR(image.data, w, h) !== null;
			});
		}
		return out;
	},

	/**
	 * Candidate 5: what a capture-resolution cap actually buys and costs. Opens
	 * the stream at several constraint sets and reports the size the browser
	 * negotiated, the detect cost there, and whether the code still reads.
	 */
	async resolutions({ iterations = 40 } = {}) {
		const v = video();
		const native = nativeDetector();
		const out = [];
		for (const constraints of [
			{ label: 'unconstrained (current default)', video: { facingMode: 'environment' } },
			{ label: 'width ideal 1280', video: { facingMode: 'environment', width: { ideal: 1280 } } },
			{ label: 'width ideal 960', video: { facingMode: 'environment', width: { ideal: 960 } } },
			{ label: 'width ideal 640', video: { facingMode: 'environment', width: { ideal: 640 } } }
		]) {
			if (v.srcObject) {
				v.srcObject.getTracks().forEach((t) => t.stop());
				v.srcObject = null;
			}
			const { label, ...rest } = constraints;
			try {
				const stream = await navigator.mediaDevices.getUserMedia(rest);
				v.srcObject = stream;
				await v.play();
				while (v.readyState < 2 || v.videoWidth === 0) await new Promise((r) => setTimeout(r, 20));
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				canvas.width = v.videoWidth;
				canvas.height = v.videoHeight;
				const detect = native
					? await perFrame(v, iterations, async (vid) => (await native.detect(vid)).length > 0)
					: await perFrame(v, iterations, (vid) => {
							ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
							const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
							return jsQR(image.data, canvas.width, canvas.height) !== null;
						});
				out.push({ label, negotiated: `${v.videoWidth}x${v.videoHeight}`, ...detect });
			} catch (err) {
				out.push({ label, error: String(err?.message ?? err) });
			}
		}
		return out;
	}
};

window.__benchReady = true;
