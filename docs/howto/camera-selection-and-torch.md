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

## Detection rate

The detect loop attempts a decode once per **delivered camera frame**, using `requestVideoFrameCallback` where the browser has it and `requestAnimationFrame` capped at about 33 ms where it does not. There is no default throttle: a frame the sender displayed and the loop never looked at is payload thrown away, so the scan rate tracks the camera instead of a timer. Because the detect call is awaited before the next frame is requested, a slow detector paces itself rather than queueing work.

`scanIntervalMs` is still available as an explicit cap ("at most this often") if you would rather spend the battery elsewhere. It has no default; before 0.2.0 it defaulted to 120 ms, which held the receiver to about 8 decode attempts per second regardless of how fast the sender ran. See the beat-frequency note in [tuning](tuning.md), and [benchmarking](benchmarking.md) for how to measure the rate on your own hardware.

## With the web component

```html
<ur-scanner auto-start facing-mode="environment"></ur-scanner>

<!-- ...or, only if you want the battery cap from above: -->
<ur-scanner auto-start facing-mode="environment" scan-interval="150"></ur-scanner>
```

The element shows a camera `<select>` automatically when two or more inputs exist (`::part(camera-select)`) and a torch button when the active track supports it (`::part(torch-button)`).

## Errors you will meet

`fromCamera` throws typed `URScannerError`s: `INSECURE_CONTEXT` (serve over HTTPS/localhost), `CAMERA_PERMISSION_DENIED`, `CAMERA_NOT_FOUND`, `CAMERA_UNSUPPORTED`. Always offer the [file-input fallback](file-and-image-input.md) when the camera cannot start.
