# How-to: benchmarking the scanner

Three benchmarks, because the pipeline has three parts and only two of them can be measured without hardware. Run them before proposing a performance change: this repo does not accept a speedup that nobody measured.

```bash
pnpm bench          # 1. the decode core, in Node
pnpm bench:camera   # 2. the camera loop, in headless Chromium
pnpm demo:build && node scripts/serve-demo.mjs   # 3. open /bench.html on a phone
```

## 1. The decode core (`bench/core.mjs`)

Pure `URReceiver`, no DOM. Reports frames-to-complete and wall clock for a size sweep, in order, shuffled, and under 40% loss, plus the per-frame cost of the three things a camera loop actually feeds a receiver: a new part, a duplicate (the common case, since a camera re-reads the same displayed frame several times), and non-UR noise.

The headline result is that this layer is not where time goes. A 16 KB payload decodes in single-digit milliseconds and a duplicate frame costs about 15 microseconds. If a scan feels slow, the core is not why.

## 2. The camera loop (`bench/camera.mjs`)

Chromium accepts a raw Y4M file as a fake camera device, so everything downstream of the lens is measurable in CI: `getUserMedia`, a real `<video>`, the canvas, the detector, the receiver. `bench/lib/y4m.mjs` renders the animated QR and holds each part for several frames, reproducing what a 30 fps camera sees when pointed at a 6 fps sender.

It reports:

- **end to end**, per sender frame rate: time to complete, scans issued, scans per second. Sweeping the sender rate is the point: a scan schedule that keeps up with a slow sender can still cap throughput against a fast one.
- **canvas cost per scan**, at full speed and under 6x CPU throttling (the DevTools emulation, a crude stand-in for a budget phone).
- **per-scan detect cost across framings**, at generous and tight pixels-per-QR-module, and at 720p and 1080p. Every row reports how many scans actually read the code, because a downscale that is faster but stops decoding is not an optimization.

### What it cannot tell you

The lens. There is no autofocus hunt, no motion blur, no exposure swing, no glare, no rolling shutter, and the frames are geometrically perfect apart from a mild blur. Treat every number as a lower bound on the work a real camera creates. It also only measures the detector the host happens to have: Chromium exposes `BarcodeDetector` on macOS but not on Linux, so CI measures the jsqr fallback and a macOS run measures the native path. The bench prints which one it used.

## 3. The real device (`demo/bench.html`)

The only place the lens exists. Serve the demo, open `/bench.html` on a phone, point it at the animated QR (this page renders one, so a laptop showing the same page works), and read measured decode attempts per second, median scan cost, time to complete, and the camera's actual delivered frame rate.

The gap between delivered camera frames and scans that read a code is the interesting number: it is how much of the stream the physical channel is throwing away, and it is what the sender-side knobs in [physical tuning](tuning.md) move.

Field numbers are welcome in [compat.md](../compat.md). Nothing on that page is uploaded anywhere.
