# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **The camera loop scans once per delivered camera frame** instead of on a fixed 120 ms timer, using `requestVideoFrameCallback` where available and `requestAnimationFrame` (capped at ~33 ms) where it is not. Animated QR is a throughput problem, and a fixed interval capped the receiver at about 8 parts per second no matter how fast the sender ran. Measured against a fake camera device: a 30 fps sender went from 2926 ms to 426 ms (6.9x), a 15 fps sender from 2003 ms to 760 ms (2.6x), a 6 fps sender is unchanged because the sender, not the loop, is the limit there. `scanIntervalMs` still works and still means "at most this often"; it is simply no longer the default bottleneck. Set it if you want the old behaviour or want to trade throughput for battery.
- **The `jsqr` fallback decodes at a capped resolution** (960 px on the long edge by default, tunable with the new `fallbackMaxSize` option). `jsqr` walks every pixel on the main thread, so this is about 2x faster on 1080p frames with no measured loss of decodability, including on a code framed tightly enough to sit at the 2 camera-pixels-per-module floor, where a 640 px cap fails to decode at all. End to end on the fallback path, a 30 fps sender went from roughly 2.6-3.4 s to about 0.42 s. The pre-change figure swings by most of a second between runs, because a loop pinned to 8 scans per second either catches a fresh part or waits for the next tick, so treat it as a range rather than a point.
- **`QRDetector.detect` now takes a `CanvasImageSource`** rather than an `HTMLCanvasElement`. This is a widening: detectors written against `HTMLCanvasElement` keep compiling and keep being handed a canvas. A detector can opt in to receiving the live `<video>` by setting the new optional `acceptsVideo` flag, which is what the built-in native and `jsqr` detectors now do, removing one full-resolution canvas copy per scan from the camera path.
- `fallbackDetector(options?)` and `resolveDetector(explicit?, options?)` take an optional `{ maxSize }`. Both remain backwards compatible when called with no options.

### Added

- `bench/`: three benchmarks, run with `pnpm bench` (the decode core, in Node) and `pnpm bench:camera` (the camera loop in headless Chromium, driven by a generated Y4M file as a fake capture device), plus `demo/bench.html` for the numbers only a real device and a real lens can produce. CI publishes the headless results to the run summary.
- Playwright now covers the camera path end to end (`getUserMedia` to bytes) against that fake camera device.
- Tests proving URs decode regardless of case, including uppercase (what a spec-correct sender emits so the QR can use alphanumeric mode) and mixed case, across the multipart sequence header, `expectedType` matching, and duplicate detection.

### Fixed

- The camera loop no longer reassigns `canvas.width` / `canvas.height` on every scan, which dropped the backing store and reset context state each time. It now resizes only when the camera's dimensions change, and only for detectors that need a canvas at all.
- `URReceiver` no longer re-submits an exact duplicate frame to `@ngraveio/bc-ur`. Its part counter has no duplicate detection of its own (see ngraveio/bc-ur#4), so a camera lingering on one frame inflated `estimatedPercent` past the true fraction of unique parts recovered.

## [0.1.0] - unreleased

Initial release: a framework-agnostic browser receiver for animated BC-UR QR codes.

### Added

- `URReceiver`: pure, DOM-free decode core over `@ngraveio/bc-ur` with type locking, `expectedType` filtering, mixed-type detection, idempotent duplicate handling, honest fountain progress (`estimatedPercent`, `receivedParts`, `expectedPartCount`, `canStartAnywhere`), an optional stall watchdog, and a callbacks-or-events API.
- Frame sources: `fromCamera` (a `CameraController` with torch and camera switching over a pluggable detector seam, native `BarcodeDetector` with a lazy `jsqr` fallback), `fromImage` (screenshots and uploads), and `fromFixture` / `playFixture` (camera-free, with deterministic `dropFraction` and `shuffle` helpers).
- `<ur-scanner>` custom element (browser-only `@nkwib/ur-scanner/element` subpath): progress ring, camera picker, torch toggle, `aria-live` announcements, CSS `::part()`s, and `ur-progress` / `ur-complete` / `ur-error` / `ur-ignore` events.
- Full error taxonomy as typed `URScannerError` codes.
- Two-device / one-device demo, fixture-driven vitest suite (including out-of-order and 40%-loss decode), and a Playwright smoke test of the demo.
- Documentation: tutorial, fountain-code explainer, architecture, reference, physical tuning field notes, testing-without-a-camera guide, framework and camera and file-input how-tos, wallet-payloads guide, and a community compatibility matrix.

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
