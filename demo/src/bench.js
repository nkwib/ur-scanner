// Real-device benchmark. The headless benches in bench/ measure everything
// downstream of the lens; they cannot measure the lens. Autofocus hunt, motion
// blur, exposure, glare and the actual capture frame rate only exist on a real
// device pointed at a real screen, and they dominate the result. This page
// reports the numbers that only a phone can produce.
import { UR, UREncoder } from '@ngraveio/bc-ur';
import QRCode from 'qrcode';
import { fromCamera, nativeDetector, resolveDetector, URReceiver } from '../../src/index.js';

const $ = (id) => document.getElementById(id);

// Sender: an animated UR to point the camera at, if you have a second screen.
let encoder = null;
let timer = null;

function buildEncoder() {
	const size = Number($('size').value);
	const text = 'BC-UR real device benchmark payload. '.repeat(Math.ceil(size / 37)).slice(0, size);
	const ur = UR.fromBuffer(Buffer.from(new TextEncoder().encode(text)));
	encoder = new UREncoder(ur, Number($('fragment').value), 0);
	$('frag-count').textContent = String(encoder.fragmentsLength);
}

async function renderFrame() {
	if (!encoder) return;
	const part = encoder.nextPart();
	// Uppercase so the QR encoder can use alphanumeric mode: about 1.45x the
	// payload per frame versus byte mode, and URs are case agnostic.
	await QRCode.toCanvas($('qr'), part.toUpperCase(), {
		errorCorrectionLevel: $('ecc').value,
		margin: 2,
		width: 320
	});
	$('part-label').textContent = part.split('/').slice(0, 2).join('/') + '/...';
}

function play() {
	buildEncoder();
	stopDisplay();
	renderFrame();
	timer = setInterval(renderFrame, Math.round(1000 / Number($('fps').value)));
}

function stopDisplay() {
	if (timer) clearInterval(timer);
	timer = null;
}

// Receiver: the measured half.
let controller = null;
let frameCounter = null;

function median(values) {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[sorted.length >> 1];
}

async function start() {
	stop();
	const video = $('video');
	const started = performance.now();
	const scanCosts = [];
	let scans = 0;
	let hits = 0;
	let cameraFrames = 0;

	// Count delivered camera frames independently of the scan loop, so a scan
	// rate can be read against the rate the hardware is actually supplying.
	if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
		const count = () => {
			cameraFrames++;
			frameCounter = video.requestVideoFrameCallback(count);
		};
		frameCounter = video.requestVideoFrameCallback(count);
	}

	// Wrap the resolved detector to time it without changing the loop.
	const inner = await resolveDetector();
	const timing = {
		acceptsVideo: inner.acceptsVideo,
		async detect(source) {
			const t0 = performance.now();
			const codes = await inner.detect(source);
			scanCosts.push(performance.now() - t0);
			scans++;
			if (codes.length > 0) hits++;
			return codes;
		}
	};

	const receiver = new URReceiver({
		onProgress: (p) => report(p, started, scans, hits, scanCosts, cameraFrames, false),
		onComplete: () => {
			report(receiver.progress, started, scans, hits, scanCosts, cameraFrames, true);
			stop();
		},
		onError: (e) => ($('status').textContent = `${e.code}: ${e.message}`)
	});

	try {
		controller = await fromCamera({ video, receiver, detector: timing });
		$('status').textContent = 'Scanning...';
	} catch (err) {
		$('status').textContent = String(err?.message ?? err);
	}
}

function report(progress, started, scans, hits, scanCosts, cameraFrames, done) {
	const elapsed = performance.now() - started;
	$('m-time').textContent = done ? `${Math.round(elapsed)} ms` : `${Math.round(elapsed)} ms (running)`;
	$('m-fps').textContent = `${((scans / elapsed) * 1000).toFixed(1)} /s`;
	$('m-scan').textContent = `${median(scanCosts).toFixed(1)} ms`;
	$('m-parts').textContent = `${progress.receivedParts} / ${progress.expectedPartCount || '?'}`;
	$('m-hits').textContent = `${hits} / ${scans}`;
	$('m-frames').textContent = cameraFrames ? `${cameraFrames} (${((cameraFrames / elapsed) * 1000).toFixed(1)} /s)` : 'n/a';
	if (done) $('status').textContent = 'Complete.';
}

function stop() {
	controller?.stop();
	controller = null;
	if (frameCounter !== null && 'cancelVideoFrameCallback' in HTMLVideoElement.prototype) {
		$('video').cancelVideoFrameCallback(frameCounter);
	}
	frameCounter = null;
}

$('play').addEventListener('click', play);
$('stop-display').addEventListener('click', stopDisplay);
$('start').addEventListener('click', () => void start());
$('stop').addEventListener('click', stop);

$('env').textContent = [
	`detector: ${nativeDetector() ? 'native BarcodeDetector' : 'jsqr fallback'}`,
	`requestVideoFrameCallback: ${'requestVideoFrameCallback' in HTMLVideoElement.prototype}`,
	`secure context: ${window.isSecureContext}`,
	`device pixel ratio: ${window.devicePixelRatio}`,
	navigator.userAgent
].join('\n');

buildEncoder();
