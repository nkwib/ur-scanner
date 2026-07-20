# Security policy

## The trust model: a camera library must earn it

This library opens a camera and reads potentially sensitive payloads (wallet keys, signed documents). That makes it a sensitive surface, and it is built accordingly:

- **All processing is local.** The camera stream goes to a canvas, the canvas to a QR detector, the strings to a decoder, entirely inside the page. There is no network request anywhere in this library and no telemetry of any kind. No frame, pixel, or byte ever leaves the page.
- **No storage.** The library keeps decode state in memory only. It writes nothing to `localStorage`, `IndexedDB`, cookies, or disk. When you drop the receiver, the bytes are gone.
- **Least privilege for the camera.** The stream is requested only when you call `start()` / `fromCamera()` and is released on `stop()` (all tracks stopped, `srcObject` cleared). Secure-context (`INSECURE_CONTEXT`) and permission errors are surfaced explicitly rather than swallowed.
- **No `eval`, no dynamic code.** The only dynamic `import()` is the optional, well-known `jsqr` fallback.

You remain responsible for what your app does with the bytes after `onComplete`. Treat them as sensitive: do not log key material, do not ship it to a server without the user's understanding.

## Supported versions

Pre-1.0: only the latest `0.x` release receives fixes.

## Reporting a vulnerability

Please report privately. Do **not** open a public issue for a security problem.

- Use GitHub's private "Report a vulnerability" (Security Advisories) on the repository, or
- email the maintainer listed in `package.json`.

Include a description, affected versions, and a reproduction (a fixture of part strings is usually enough, no camera required). We aim to acknowledge within a few days and will credit you in the advisory unless you prefer otherwise.
