# Tutorial: from zero to scanned bytes

By the end you will have a sender page that displays an animated UR, a scanner page that receives it, and a one-device variant that needs no camera. This is a learning path: follow it top to bottom.

## Glossary (used everywhere in these docs)

- **UR**: the whole self-describing payload, `ur:bytes/...`.
- **fragment** (a.k.a. **source part**): one slice of the payload; there are *K* of them.
- **part**: one animated frame / one QR image. Parts are a rateless stream.
- **sequence**: the ordered fragments that reconstruct the payload.

## 0. Install

```bash
npm i @nkwib/ur-scanner @ngraveio/bc-ur
npm i jsqr   # optional fallback for browsers without a native BarcodeDetector
```

## 1. Build a sender (so you have something to scan)

This library only receives. To produce frames, use `@ngraveio/bc-ur`'s `UREncoder` with any QR renderer. The encoder is rateless: call `nextPart()` on every display tick forever.

```ts
import { UR, UREncoder } from '@ngraveio/bc-ur';
import QRCode from 'qrcode'; // any renderer works

const payload = new TextEncoder().encode('a multi-KB payload goes here...');
const encoder = new UREncoder(UR.fromBuffer(Buffer.from(payload)), 90 /* fragment size */, 0);

const canvas = document.querySelector('canvas')!;
setInterval(async () => {
  await QRCode.toCanvas(canvas, encoder.nextPart().toUpperCase(), { margin: 2, width: 320 });
}, 1000 / 6); // 6 fps is a good starting point (see the tuning guide)
```

`fragment size` and `fps` are the two knobs that decide how fast and how robust the transfer is. The [tuning guide](howto/tuning.md) has a tested-defaults table. The runnable version of this is [`examples/sender.ts`](../examples/sender.ts).

## 2. Build the scanner page

The fastest path is the web component. Import the browser-only `element` subpath, drop the tag in, listen for `ur-complete`:

```html
<ur-scanner auto-start expected-type="bytes"></ur-scanner>
<pre id="out"></pre>

<script type="module">
  import '@nkwib/ur-scanner/element';
  const scanner = document.querySelector('ur-scanner');
  scanner.addEventListener('ur-complete', (e) => {
    const bytes = e.detail.cbor;                 // Uint8Array
    out.textContent = new TextDecoder().decode(new Uint8Array(e.detail.decodeCbor()));
    scanner.stop();
  });
  scanner.addEventListener('ur-error', (e) => console.error(e.detail.code, e.detail.message));
</script>
```

Serve both pages over **HTTPS or `localhost`** (cameras refuse insecure origins), open the sender on one screen and the scanner on another, and point the camera. The ring fills and the bytes appear.

Prefer to own the loop? Use the headless core instead:

```ts
import { fromCamera } from '@nkwib/ur-scanner';

const cam = await fromCamera({
  video: document.querySelector('video')!,
  expectedType: 'bytes',
  onProgress: (p) => (ring.style.setProperty('--pct', String(p.estimatedPercent))),
  onComplete: (ur) => { cam.stop(); use(ur.cbor); },
  onError: (e) => showError(e.code),
});
```

## 3. The one-device variant (no camera)

You can prove the whole pipeline on a single machine by feeding known frames. Capture a sequence from the sender and hand it to `fromFixture`, or set the web component's `fixture` attribute:

```ts
import { fromFixture } from '@nkwib/ur-scanner';
import { captureSequence } from '../examples/sender.js';

const parts = captureSequence(new TextEncoder().encode('hello over an air gap'));
const { progress, receiver } = fromFixture(parts);
console.log(progress.complete, receiver.type); // true 'bytes'
```

```html
<!-- the element decodes its own attribute; great for demos and screenshots -->
<ur-scanner id="s"></ur-scanner>
<script type="module">
  import '@nkwib/ur-scanner/element';
  s.setAttribute('fixture', JSON.stringify(parts));
  s.start();
</script>
```

This is exactly what the [demo](../demo/)'s **Simulate** button does and what the tests use. Next steps: [testing without a camera](howto/testing.md), [frameworks](howto/frameworks.md), and the [reference](reference.md).
