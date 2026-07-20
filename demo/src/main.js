// Demo entry: one page that both DISPLAYS an animated UR (the "sender", what
// your laptop shows) and SCANS one (the "receiver", using this library's own
// <ur-scanner> element). Point a phone running this same page at the laptop and
// the bytes transfer. Or hit "Simulate" for the one-device fixture path.
import { UR, UREncoder } from '@ngraveio/bc-ur';
import QRCode from 'qrcode';
import '../../src/element.js'; // registers <ur-scanner>

const $ = (id) => document.getElementById(id);

// ── Sender: encode text into an animated, fountain-coded UR ───────────────────
let encoder = null;
let timer = null;
let parts = []; // captured stream, reused for the one-device fixture mode

function buildEncoder() {
	const text = $('payload').value;
	const fragment = Number($('fragment').value);
	const ur = UR.fromBuffer(Buffer.from(new TextEncoder().encode(text)));
	encoder = new UREncoder(ur, fragment, 0);
	parts = [];
	$('frag-count').textContent = String(encoder.fragmentsLength);
}

async function renderFrame() {
	if (!encoder) return;
	const part = encoder.nextPart();
	parts.push(part);
	if (parts.length > 200) parts.shift();
	await QRCode.toCanvas($('qr'), part.toUpperCase(), {
		errorCorrectionLevel: $('ecc').value,
		margin: 2,
		width: 320
	});
	$('part-label').textContent = part.split('/').slice(0, 2).join('/') + '/…';
}

function startDisplay() {
	buildEncoder();
	stopDisplay();
	const fps = Number($('fps').value);
	renderFrame();
	timer = setInterval(renderFrame, Math.round(1000 / fps));
}

function stopDisplay() {
	if (timer) clearInterval(timer);
	timer = null;
}

// ── Receiver wiring (this library's <ur-scanner>) ─────────────────────────────
const scanner = $('scanner');

scanner.addEventListener('ur-progress', (e) => {
	const p = e.detail;
	$('rx-status').textContent = p.expectedPartCount
		? `${Math.round(p.estimatedPercent * 100)}% · ${p.receivedParts}/${p.expectedPartCount} parts · seen ${p.framesSeen} frames`
		: 'Looking for an animated QR…';
});

scanner.addEventListener('ur-complete', (e) => {
	const ur = e.detail;
	let text = '';
	try {
		text = new TextDecoder().decode(new Uint8Array(ur.decodeCbor()));
	} catch {
		text = '(binary payload)';
	}
	$('rx-status').textContent = `Done — ${ur.cbor.length} bytes, type "${ur.type}"${ur.wasSinglePart ? ' (single-part; a static QR would have done)' : ''}`;
	$('rx-out').textContent = text;
	$('rx-out').hidden = false;
});

scanner.addEventListener('ur-error', (e) => {
	$('rx-status').textContent = `${e.detail.code}: ${e.detail.message}`;
});

// ── Controls ──────────────────────────────────────────────────────────────────
$('encode').addEventListener('click', startDisplay);
$('stop-display').addEventListener('click', stopDisplay);

$('start-camera').addEventListener('click', () => {
	scanner.removeAttribute('fixture');
	scanner.start();
});

$('simulate').addEventListener('click', () => {
	// One-device path: feed the sender's own captured frames into the scanner.
	if (parts.length < 3) {
		buildEncoder();
		for (let i = 0; i < encoder.fragmentsLength * 3; i++) parts.push(encoder.nextPart());
	}
	scanner.setAttribute('fixture', JSON.stringify(parts));
	scanner.start();
});

$('reset').addEventListener('click', () => {
	scanner.stop();
	$('rx-out').hidden = true;
	$('rx-status').textContent = 'Idle';
});

// Kick off the display so the page is alive on load.
startDisplay();
