/**
 * Generate deterministic multipart-UR fixtures with @ngraveio/bc-ur and write
 * them to tests/fixtures/. These serialized frame sequences drive the decode
 * tests (out-of-order, lossy) and the demo's one-device fixture mode, so the
 * library is exercised end-to-end without a camera. Committed for stability;
 * re-run with `pnpm fixtures` after a bc-ur upgrade.
 */
import { UR, UREncoder } from '@ngraveio/bc-ur';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'tests', 'fixtures');
mkdirSync(outDir, { recursive: true });

/** Build a redundant fountain sequence: K pure parts + extra mixed parts. */
function sequence(payload, fragmentLen, overshoot) {
	const ur = UR.fromBuffer(Buffer.from(payload));
	const enc = new UREncoder(ur, fragmentLen, 0);
	const k = enc.fragmentsLength;
	const parts = [];
	const total = Math.max(k + 1, Math.ceil(k * overshoot));
	for (let i = 0; i < total; i++) parts.push(enc.nextPart());
	return { type: ur.type, payloadHex: Buffer.from(payload).toString('hex'), fragmentCount: k, parts };
}

const message =
	'BC-UR turns a multi-kilobyte payload into a stream of QR frames that a ' +
	'camera can recover even when it misses many of them. This fixture is a ' +
	'byte string large enough to require a genuine multipart sequence, so the ' +
	'decode tests can drop and reorder frames and still reconstruct the exact ' +
	'original bytes. The quick brown fox jumps over the lazy dog, repeatedly.';

const bytes = sequence(new TextEncoder().encode(message), 40, 5);
const single = sequence(new TextEncoder().encode('hello ur'), 500, 1);

// A different UR type, for the mixed-type-detection test.
const foreignUr = new UR(Buffer.from('a1626964182a', 'hex'), 'custom-widget');
const foreignEnc = new UREncoder(foreignUr, 20, 0);
const foreignParts = [];
for (let i = 0; i < foreignEnc.fragmentsLength * 3; i++) foreignParts.push(foreignEnc.nextPart());
const foreign = { type: 'custom-widget', parts: foreignParts };

writeFileSync(join(outDir, 'bytes.multipart.json'), JSON.stringify(bytes, null, '\t') + '\n');
writeFileSync(join(outDir, 'bytes.single.json'), JSON.stringify(single, null, '\t') + '\n');
writeFileSync(join(outDir, 'foreign.multipart.json'), JSON.stringify(foreign, null, '\t') + '\n');

console.log(
	`fixtures written: bytes=${bytes.fragmentCount} fragments / ${bytes.parts.length} parts, ` +
		`single=${single.parts.length} part, foreign=${foreign.parts.length} parts`
);
