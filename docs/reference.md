# API reference

Every public export, the `<ur-scanner>` surface, and the complete error taxonomy. Types are the source of truth; this mirrors them.

## Entry points

| Import | What | DOM-safe? |
| --- | --- | --- |
| `@nkwib/ur-scanner` | core + frame sources + detector seam | yes (safe in SSR bundles) |
| `@nkwib/ur-scanner/element` | side-effectful: registers `<ur-scanner>` | no (browser only) |

## `class URReceiver`

The pure decode core. `new URReceiver(options?)`.

### `URReceiverOptions`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `expectedType` | `string` | none | Reject any part whose UR type differs (case-insensitive). Emits `UNEXPECTED_TYPE`. |
| `stallTimeoutMs` | `number` | off | Emit `DECODE_STALL` if no *new* part arrives in this window while incomplete. |
| `onProgress` | `(p: Progress) => void` | | Convenience for `on('progress', ...)`. |
| `onComplete` | `(r: DecodedUR) => void` | | |
| `onError` | `(e: URScannerError) => void` | | |
| `onIgnore` | `(i: IgnoredFrame) => void` | | |

### Methods and properties

| Member | Signature | Notes |
| --- | --- | --- |
| `addPart` | `(text: string) => Progress` | Feed one scanned string. Idempotent; safe with noise. Returns progress after this frame. |
| `progress` | `Progress` (getter) | Current snapshot without feeding. |
| `isComplete` | `boolean` (getter) | |
| `type` | `string \| null` (getter) | Locked UR type, or `null` before the first accepted part. |
| `on` | `(event, listener) => () => void` | Returns an unsubscribe function. Events: `progress`, `complete`, `error`, `ignore`. |
| `off` | `(event, listener) => void` | |
| `reset` | `() => void` | Discard all state to start a fresh scan. |
| `dispose` | `() => void` | Clear the stall timer and all listeners. |

### `Progress`

```ts
interface Progress {
  type: string | null;          // locked UR type
  receivedParts: number;        // distinct source fragments recovered
  expectedPartCount: number;    // K; 0 until the first well-formed part
  estimatedPercent: number;     // 0..1 from the decoder, NOT received/expected
  framesSeen: number;           // every raw frame fed, incl. dupes and noise
  canStartAnywhere: true;       // a fact about fountain codes
  complete: boolean;
}
```

### `DecodedUR` (delivered on completion)

```ts
interface DecodedUR {
  type: string;                 // e.g. 'bytes', 'crypto-hdkey'
  cbor: Uint8Array;             // the raw UR body (CBOR), always present
  wasSinglePart: boolean;       // true => a static QR would have done; not an error
  decodeCbor(): unknown;        // CBOR-decoded value; for ur:bytes this is your payload bytes
}
```

### `IgnoredFrame`

```ts
interface IgnoredFrame {
  reason: 'not-a-ur' | 'mixed-type' | 'malformed' | 'duplicate';
  text: string;                 // truncated
  seenType?: string;            // when reason is 'mixed-type'
}
```

## Frame sources

### `fromCamera(options?): Promise<CameraController>`

`CameraSourceOptions` extends `URReceiverOptions` with:

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `video` | `HTMLVideoElement` | one is created | Caller-owned, so layout stays yours. |
| `constraints` | `MediaStreamConstraints` | `{ video: { facingMode: 'environment' } }` | Passed straight to `getUserMedia`. |
| `receiver` | `URReceiver` | a new one | Share it with a file-input fallback. |
| `detector` | `QRDetector` | native, then `jsqr` | See the detector seam below. |
| `scanIntervalMs` | `number` | none | Minimum ms between detect attempts. Unset scans every delivered camera frame. |
| `fallbackMaxSize` | `number` | `960` | Long-edge cap before the `jsqr` fallback decodes. Ignored for native or explicit detectors. |

The loop runs once per **delivered camera frame** via `requestVideoFrameCallback`, falling back to `requestAnimationFrame` capped at about 33 ms where that API is missing. Every frame the sender displays and the loop does not look at is payload thrown away, so the scan rate tracks the camera rather than a timer. Set `scanIntervalMs` to cap it for battery: it was 120 by default before 0.2.0, which limited the receiver to about 8 parts per second regardless of the sender.

`CameraController`: `receiver`, `video`, `stop()`, `hasTorch()`, `torch(on)`, `listVideoInputs()`, `switchCamera(deviceId)`. See [camera selection and torch](howto/camera-selection-and-torch.md) and [benchmarking](howto/benchmarking.md).

### `fromImage(source, options?): Promise<{ receiver, progress, found }>`

`source`: `Blob | File | ImageBitmap | HTMLImageElement | HTMLCanvasElement | string(url)`. Decodes every QR in one still and feeds them. Thread a `receiver` across calls for multi-part uploads. See [file and image input](howto/file-and-image-input.md).

### `fromFixture(parts, options?): { receiver, progress }`

Feed a `string[]` synchronously. `playFixture(parts, { intervalMs, loop, onFrame, ... })` plays them on a timer and returns `{ receiver, stop, done }`. Test utilities: `dropFraction(parts, fraction, seed?)` and `shuffle(parts, seed?)` (both deterministic). See [testing without a camera](howto/testing.md).

## Detector seam

- `nativeDetector(): QRDetector | null` : native `BarcodeDetector`, or `null` if absent.
- `fallbackDetector(options?: { maxSize?: number }): Promise<QRDetector>` : lazily `import()`s `jsqr`; throws `DETECTOR_UNSUPPORTED` if not installed. `maxSize` caps the long edge before decoding.
- `resolveDetector(explicit?, options?: { maxSize?: number }): Promise<QRDetector>` : explicit, then native, then fallback. `options` only reaches the fallback.

```ts
interface QRDetector {
  detect(source: CanvasImageSource): Promise<DetectedCode[]>;
  readonly acceptsVideo?: boolean;   // set it to be handed the <video> directly
}
interface DetectedCode { rawValue: string }
```

`detect` took an `HTMLCanvasElement` before 0.2.0. The widening is source compatible: a detector written against `HTMLCanvasElement` still compiles, and still receives a canvas. Set `acceptsVideo` to be handed the live `<video>` instead, which saves the camera loop a full-resolution copy per scan. Both built-in detectors set it.

## `<ur-scanner>` custom element

Register with `import '@nkwib/ur-scanner/element'` (or call `defineURScanner(tag?)`).

### Attributes

| Attribute | Values | Notes |
| --- | --- | --- |
| `auto-start` | boolean (presence) | Start on connect. |
| `expected-type` | string | Forwarded to the receiver. |
| `facing-mode` | `environment` \| `user` | Camera preference. |
| `scan-interval` | number (ms) | Cap on detect attempts. Unset scans every delivered camera frame. |
| `fixture` | JSON `string[]` | One-device / demo mode: play these parts instead of the camera. |

### Methods, events, CSS parts

- **Methods**: `start()`, `stop()`, `reset()`.
- **Events** (bubbling, composed `CustomEvent`s): `ur-progress` (detail `Progress`), `ur-complete` (detail `DecodedUR`), `ur-error` (detail `URScannerError`), `ur-ignore` (detail `IgnoredFrame`).
- **CSS parts**: `container`, `video`, `overlay`, `ring`, `status`, `controls`, `camera-select`, `torch-button`. Style the ring fill via `::part(ring)` descendants; the accent stroke is a plain SVG you can override.

## Error taxonomy

Every failure is a `URScannerError` with a stable `code`. Branch on `code`, never on `message`.

| `code` | Layer | Trigger | Fatal? | Suggested user copy |
| --- | --- | --- | --- | --- |
| `INSECURE_CONTEXT` | camera | page served over plain HTTP | yes | "Camera needs a secure (HTTPS) page." |
| `CAMERA_UNSUPPORTED` | camera | no `getUserMedia` | yes | "This browser cannot open the camera. Upload a photo instead." |
| `CAMERA_PERMISSION_DENIED` | camera | `NotAllowedError` | yes | "Camera permission was denied. Enable it in site settings." |
| `CAMERA_NOT_FOUND` | camera | `NotFoundError` / `OverconstrainedError` | yes | "No camera found." |
| `DETECTOR_UNSUPPORTED` | detector | no native detector and `jsqr` missing | yes | "Install the QR fallback, or use a Chromium browser." |
| `UNEXPECTED_TYPE` | core | first part's type != `expectedType` | yes (rejects) | "That is not the code we expected." |
| `MIXED_UR_TYPES` | core | a foreign UR type appears mid-scan | no (warns, keeps going) | usually silent; keep scanning the right code |
| `DECODE_STALL` | core | no new part within `stallTimeoutMs` | no (informational) | "Not receiving frames. Move closer / clean the lens." |
| `DECODE_FAILED` | core | decoder reports an unrecoverable stream error | yes | "That code stream could not be decoded." |

Two related non-errors, documented here because people look for them:

- **Single-part UR**: not an error. The scan completes and `DecodedUR.wasSinglePart` is `true`, meaning the payload fit in one static QR and animation was unnecessary. Surface it as a hint if you like.
- **Non-UR noise** (a URL, a Wi-Fi QR): not an error either. It is counted in `framesSeen` and reported via the `ignore` event with reason `not-a-ur`, so the scanner shrugs off unrelated codes instead of failing.

## Event lifecycle

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Scanning: start() / first addPart()
  Scanning --> Scanning: ur-progress (each accepted part)
  Scanning --> Scanning: ur-ignore (dupe / noise / mixed-type)
  Scanning --> Complete: ur-complete (isSuccess)
  Scanning --> Failed: ur-error (fatal code)
  Complete --> Idle: reset()
  Failed --> Idle: reset()
  Complete --> [*]: stop() / dispose()
```
