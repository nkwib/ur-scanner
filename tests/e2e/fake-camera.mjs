/**
 * Generate the animated-QR video that Chromium plays back as a fake camera for
 * the end-to-end camera spec. Without this the camera path is the one layer CI
 * never touches, which is precisely the layer this library exists to provide.
 *
 * Kept small on purpose: three source fragments, generously framed, so the run
 * costs a couple of seconds and decodes on the jsqr fallback that Chromium on
 * Linux is limited to (no `BarcodeDetector` there).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sequence } from '../../bench/lib/sequences.mjs';
import { writeY4M } from '../../bench/lib/y4m.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const FAKE_CAMERA_Y4M = join(root, 'bench', '.tmp', 'e2e-camera.y4m');

export default function globalSetup() {
	mkdirSync(dirname(FAKE_CAMERA_Y4M), { recursive: true });
	const seq = sequence({ payloadBytes: 256, fragmentLen: 100, overshoot: 1 });
	writeY4M(seq.parts.slice(0, seq.fragmentCount + 3), {
		path: FAKE_CAMERA_Y4M,
		width: 1024,
		height: 768,
		fps: 30,
		hold: 3,
		fill: 0.5
	});
}
