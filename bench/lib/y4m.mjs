/**
 * Render UR part strings into a raw Y4M video that Chromium can play back as a
 * fake camera device (`--use-file-for-fake-video-capture`). This is what makes
 * the camera loop measurable without hardware: a real `getUserMedia` stream, a
 * real `<video>`, real detector work, deterministic frame by frame.
 *
 * `hold` is the honest bit. A phone camera delivers ~30 fps while a sender
 * animates at 4-8 fps, so the same QR is captured several times in a row.
 * Holding each part for `hold` frames of a `fps`-rate file reproduces that
 * exactly, which is what lets the bench show whether a fixed scan interval
 * aliases against the sender.
 *
 * These frames are synthetic: correct geometry, a mild blur, no rolling
 * shutter, no autofocus hunt, no glare. Treat every number derived from them as
 * a lower bound on what a real camera makes the loop do, and see
 * `demo/bench.html` for the real-device number.
 */
import QRCode from 'qrcode';
import { closeSync, existsSync, openSync, writeSync } from 'node:fs';

/** Rasterise one QR into a full-frame luma plane (255 = white, 0 = black). */
function lumaFrame(text, { width, height, fill, ecc }) {
	const qr = QRCode.create(text, { errorCorrectionLevel: ecc });
	const size = qr.modules.size;
	const data = qr.modules.data;
	const quiet = 4;
	const total = size + quiet * 2;
	// Integer module scale only: a fractional one would blur module edges in a
	// way that is an artefact of the generator rather than of any real camera.
	const scale = Math.max(1, Math.floor((Math.min(width, height) * fill) / total));
	const px = total * scale;
	const ox = (width - px) >> 1;
	const oy = (height - px) >> 1;

	const y = new Uint8Array(width * height).fill(255);
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (!data[r * size + c]) continue;
			const x0 = ox + (c + quiet) * scale;
			const y0 = oy + (r + quiet) * scale;
			for (let dy = 0; dy < scale; dy++) {
				const row = (y0 + dy) * width + x0;
				y.fill(0, row, row + scale);
			}
		}
	}
	return { y, modules: size, pxPerModule: scale, qrPx: px };
}

/** One pass of a 3x3 box blur: a cheap stand-in for slight camera defocus. */
function blurPass(src, width, height) {
	const out = new Uint8Array(src.length);
	for (let y = 0; y < height; y++) {
		const up = y > 0 ? -width : 0;
		const down = y < height - 1 ? width : 0;
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			const left = x > 0 ? -1 : 0;
			const right = x < width - 1 ? 1 : 0;
			out[i] =
				(src[i + up + left] + src[i + up] + src[i + up + right] +
					src[i + left] + src[i] + src[i + right] +
					src[i + down + left] + src[i + down] + src[i + down + right]) / 9;
		}
	}
	return out;
}

/**
 * Write `parts` as an animated-QR Y4M file. Skips the write when the file is
 * already there (these are tens of megabytes and fully determined by `opts`).
 *
 * @returns `{ path, frames, modules, pxPerModule, qrPx, senderFps }`
 */
export function writeY4M(parts, opts) {
	const { path, width = 1280, height = 720, fps = 30, hold = 5, fill = 0.45, ecc = 'M', blur = 1 } = opts;
	const first = lumaFrame(parts[0], { width, height, fill, ecc });
	const meta = {
		path,
		frames: parts.length * hold,
		modules: first.modules,
		pxPerModule: first.pxPerModule,
		qrPx: first.qrPx,
		senderFps: fps / hold,
		width,
		height,
		fps
	};
	if (existsSync(path)) return meta;

	const chroma = new Uint8Array((width >> 1) * (height >> 1)).fill(128);
	const fd = openSync(path, 'w');
	try {
		writeSync(fd, `YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420mpeg2\n`);
		for (const part of parts) {
			// Uppercase: what a spec-correct sender emits, so the QR can use
			// alphanumeric mode. Lowercase here would inflate every frame.
			let { y } = lumaFrame(part.toUpperCase(), { width, height, fill, ecc });
			for (let i = 0; i < blur; i++) y = blurPass(y, width, height);
			writeSync(fd, 'FRAME\n');
			for (let i = 0; i < hold; i++) {
				writeSync(fd, y);
				writeSync(fd, chroma);
				writeSync(fd, chroma);
				if (i < hold - 1) writeSync(fd, 'FRAME\n');
			}
		}
	} finally {
		closeSync(fd);
	}
	return meta;
}
