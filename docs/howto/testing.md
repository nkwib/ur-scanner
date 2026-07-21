# How-to: testing without a camera

You cannot put a webcam in CI, and you should not have to. This library is built so that the whole pipeline is exercisable from strings. This guide shows how *this* package tests itself and how *your* app can unit-test its integration.

## The core takes strings, so tests take strings

`URReceiver.addPart(text)` and `fromFixture(parts)` are the seam. A fixture is just an array of UR part strings, which you generate once with `@ngraveio/bc-ur` and reuse forever.

```ts
import { UR, UREncoder } from '@ngraveio/bc-ur';

export function captureSequence(payload: Uint8Array, fragment = 40, overshoot = 5): string[] {
  const enc = new UREncoder(UR.fromBuffer(Buffer.from(payload)), fragment, 0);
  const parts: string[] = [];
  for (let i = 0; i < enc.fragmentsLength * overshoot; i++) parts.push(enc.nextPart());
  return parts; // K pure parts + mixed parts, plenty to survive heavy loss
}
```

This package commits such sequences under `tests/fixtures/*.json` (regenerate with `pnpm fixtures`). Committing them keeps tests deterministic and documents the wire format.

## Out-of-order and lossy decode (the important test)

Fountain codes promise recovery under loss and reordering, so the test suite proves it. `shuffle` and `dropFraction` are exported, deterministic helpers:

```ts
import { fromFixture, dropFraction, shuffle } from '@nkwib/ur-scanner';
import parts from './fixtures/bytes.multipart.json'; // { parts: string[], payloadHex, ... }

it('recovers under 40% frame loss, out of order', () => {
  const lossy = shuffle(dropFraction(parts.parts, 0.4, /* seed */ 3), /* seed */ 9);
  const { receiver } = fromFixture(lossy);
  expect(receiver.isComplete).toBe(true);
});
```

That is exactly the guarantee that makes animated QR usable, so it is the test that must never regress.

## Synthetic camera with `canvas.captureStream`

To test the *camera* path without hardware, paint frames onto a `<canvas>` and turn it into a `MediaStream`:

```ts
const canvas = document.createElement('canvas');
const stream = canvas.captureStream(6); // a 6 fps MediaStream, no webcam
// draw each UR part as a QR onto the canvas on a timer, then point a detector at it.
```

In a real browser (Playwright) this drives the whole stack. In jsdom there is no canvas raster backend, so unit tests instead inject a **stub detector** that returns scripted strings and skips pixels entirely:

```ts
import { fromImage, type QRDetector } from '@nkwib/ur-scanner';

const stub: QRDetector = { async detect() { return [{ rawValue: parts.parts[0] }]; } };
const { found } = await fromImage(document.createElement('img'), { detector: stub });
expect(found).toEqual([parts.parts[0]]);
```

The pluggable detector is the reason the camera and image sources are testable at all: `resolveDetector` prefers whatever you pass in.

## How this package is wired (copy it)

- **vitest**, node environment for the pure core (`tests/*.test.ts`), jsdom for DOM specs (`tests/*.dom.test.ts`).
- **Playwright** drives the real demo in Chromium (`tests/e2e/demo.spec.ts`): it clicks **Simulate**, which encodes with bc-ur and feeds the element's `fixture` attribute, then asserts the decoded text appears. That is a full encode -> element -> decode round-trip with no camera.

## Downstream apps

To unit-test *your* integration, do not mock the library: feed it a captured fixture. Assert your `onComplete` handler fires with the right bytes, your progress UI advances, and your error UI shows the right `code` when you feed noise or a wrong-type part. Everything you need (`fromFixture`, `dropFraction`, `shuffle`, a stub `QRDetector`) is a public export.
