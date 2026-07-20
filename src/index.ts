/**
 * `@blocco/ur-scanner` - a browser receiver for animated QR codes carrying
 * BC-UR (Uniform Resources) payloads. Camera to bytes, no wallet required.
 *
 * This entry is DOM-safe to import anywhere (including server bundles): nothing
 * here touches `window`/`HTMLElement` at module scope. The `<ur-scanner>` custom
 * element lives behind the browser-only `@blocco/ur-scanner/element` subpath.
 *
 * @packageDocumentation
 */
export { URReceiver } from './receiver.js';
export { Emitter } from './emitter.js';
export { URScannerError, cameraErrorFrom } from './errors.js';
export type { URScannerErrorCode } from './errors.js';
export type {
	Progress,
	DecodedUR,
	IgnoredFrame,
	URReceiverOptions,
	URReceiverEvents
} from './types.js';

// Frame sources
export { fromCamera } from './sources/camera.js';
export type { CameraController, CameraSourceOptions } from './sources/camera.js';
export { fromImage } from './sources/image.js';
export type { ImageSource, ImageSourceOptions } from './sources/image.js';
export { fromFixture, playFixture, dropFraction, shuffle } from './sources/fixture.js';
export type { FixtureOptions } from './sources/fixture.js';

// Detector seam
export { nativeDetector, fallbackDetector, resolveDetector } from './sources/detector.js';
export type { QRDetector, DetectedCode } from './sources/detector.js';
