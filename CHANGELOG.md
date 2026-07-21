# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
