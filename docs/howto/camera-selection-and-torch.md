# How-to: camera selection and torch

`fromCamera` returns a `CameraController` with everything you need to pick a lens and light the subject. The `<ur-scanner>` element wires a picker and torch button for you; drop to the controller when you want your own UI.

## Start on the back camera

The default constraints prefer the environment-facing camera, which is what you want for scanning another screen:

```ts
import { fromCamera } from '@nkwib/ur-scanner';
const cam = await fromCamera({ video, constraints: { video: { facingMode: 'environment' } } });
```

`facingMode` is a *preference*, not a guarantee. On a multi-camera phone the OS may hand you a wide or macro lens that focuses poorly at scanning distance. If scanning is flaky, enumerate and pick explicitly.

## List and switch cameras

Device labels are only populated **after** a camera permission has been granted, so call `listVideoInputs()` once scanning has started.

```ts
const inputs = await cam.listVideoInputs();          // MediaDeviceInfo[]
// e.g. render a <select>, then:
await cam.switchCamera(inputs[1].deviceId);
```

`switchCamera` stops the current stream and reopens on the chosen device, keeping the same receiver and progress.

## Torch (flashlight)

Torch is supported on some Android/Chromium devices and essentially no iOS browser. Feature-detect before showing a button:

```ts
if (cam.hasTorch()) {
  torchButton.hidden = false;
  torchButton.onclick = () => cam.torch(!(torchButton.dataset.on === '1'));
}
```

`torch(on)` is a no-op where unsupported, so it is safe to call blind. The torch capability lives on the active `MediaStreamTrack`; switching cameras can change whether it exists, so re-check `hasTorch()` after `switchCamera`.

## Detection throttle

The detect loop runs on `requestAnimationFrame` but only *attempts* a decode every `scanIntervalMs` (default 120ms, about 8/s). Decoding every animation frame wastes battery and can actually lower throughput on a busy main thread. Raise the interval on low-end devices; lower it if you have CPU to spare and want faster locks. See the beat-frequency note in [tuning](tuning.md).

## With the web component

```html
<ur-scanner auto-start facing-mode="environment" scan-interval="150"></ur-scanner>
```

The element shows a camera `<select>` automatically when two or more inputs exist (`::part(camera-select)`) and a torch button when the active track supports it (`::part(torch-button)`).

## Errors you will meet

`fromCamera` throws typed `URScannerError`s: `INSECURE_CONTEXT` (serve over HTTPS/localhost), `CAMERA_PERMISSION_DENIED`, `CAMERA_NOT_FOUND`, `CAMERA_UNSUPPORTED`. Always offer the [file-input fallback](file-and-image-input.md) when the camera cannot start.
