# How-to: physical tuning (field notes)

Animated QR is a physical channel: two screens, a lens, and light. The defaults in this library are good, but the sender's choices (fragment size, fps, ECC, brightness) decide whether a scan is instant or infuriating. This is the knowledge that usually only exists in people's heads. Some rows are measured; the ones we have not personally verified are marked so, and are a [community-PR target](../compat.md).

## The two knobs that matter most

**Fragment size** (bytes per part, the `UREncoder` argument) sets how dense each QR is. **Display fps** sets how fast parts change. They trade against each other:

- Bigger fragments -> fewer total parts -> fewer frames to collect, **but** each QR has more modules, needs a sharper camera and steadier hand, and fails sooner at distance or in blur.
- Smaller fragments -> sparser, more forgiving QRs -> **but** more parts, so more frames and more display time.
- Higher fps -> more parts per second reach the camera, **until** it exceeds what the camera can cleanly capture, at which point motion blur and the beat effect (below) waste frames.

The sweet spot is the largest fragment your worst expected camera can read at your working distance, at the highest fps that still yields clean captures. Start at the tested defaults and adjust one knob at a time.

## Tested-defaults table

Sender-side settings. "Verified" means we have run it in this library's parent app or its Playwright/Chromium smoke; everything else is a reasoned starting point wanting field reports.

| Scenario | Fragment size | Display fps | ECC | Notes | Verified |
| --- | --- | --- | --- | --- | --- |
| Desktop screen -> modern phone, indoors | 90-120 B | 6-8 | M | the common case; fast and reliable | Chromium smoke + parent-app field use |
| Phone -> phone, arm's length | 60-90 B | 5-6 | M | smaller QR tolerates hand shake | parent-app field use |
| Direct sunlight (outdoor comp desk) | 40-60 B | 4-5 | Q | see the sunlight section; smaller + higher ECC wins | parent-app field use, direct sun |
| Low-end / old Android camera | 40-60 B | 4 | Q | give the autofocus time per frame | community verification wanted |
| E-ink or low-refresh sender | 30-40 B | 1-2 | H | slow refresh; keep parts tiny | community verification wanted |
| Projector / across a room | 30-50 B | 3-4 | H | distance eats module resolution | community verification wanted |

Receiver-side, this library defaults to `scanIntervalMs: 120` (about 8 decode attempts/sec), which pairs well with 4-8 fps senders. Raise it on slow devices.

## QR module density vs camera distance

A QR's readability is governed by *camera pixels per module*. Roughly you want at least 3 to 4 camera pixels per QR module. Doubling the working distance halves the modules' pixel size, so a code that reads at 20 cm may be unreadable at 40 cm. Two levers: fewer modules (smaller fragment, lower ECC) or more camera pixels on the code (move closer, zoom, or a higher-res camera). When in doubt, shrink the fragment before anything else.

## ECC level choice

QR error-correction (L 7%, M 15%, Q 25%, H 30%) is *per frame* and independent of the fountain layer *across* frames. They stack: ECC saves a smudged individual frame; fountain codes save you from frames that never arrive. Use M indoors. Step up to Q or H when the surface is hostile (sun, glare, motion, distance): higher ECC adds modules, so pair it with a smaller fragment to keep density constant.

## Sunlight (hard-won)

This library's parent app is scanned on an outdoor bouldering competition desk in direct sun, and sun is the worst case by a wide margin. What works:

- **Smaller fragments + higher ECC** (Q/H). Sun destroys contrast; sparse, redundant codes survive.
- **Maximum sender brightness**, and shade the sender screen if you can (a hand, a body). Contrast, not absolute brightness, is what the camera needs.
- **Kill auto-brightness** on the sender: it dims mid-scan and drops a run of frames.
- **Matte helps, glossy hurts.** A glossy screen mirrors the sky straight into the lens.
- **Angle off the sun** so neither screen catches a specular reflection.

## Screen brightness and moire

Photographing one grid of pixels with another grid of sensor pixels produces moire (shimmering interference bands) that can obscure modules. Mitigations: do not over-zoom (moire is worst when module size is near the sensor's pixel pitch), nudge the distance slightly, and keep sender brightness high for contrast. A tiny device tilt often makes a moire band slide off the code.

## Display fps vs camera fps beat effects

Sender fps and camera capture fps are independent clocks. When they are close or share a simple ratio, they *beat*: the camera repeatedly samples the same part, or catches the display mid-refresh (a torn, half-old-half-new frame that decodes as garbage). This is why cranking sender fps does not linearly speed things up, and can slow them down. Practical rule: keep sender fps well below the camera's capture rate (most phone cameras preview at 30 fps, so 4 to 8 fps sender is safely clear), and if throughput plateaus, change the fps by a couple rather than pushing higher. Because the stream is fountain-coded, an occasional torn frame is simply ignored and the next clean part carries new information: see [fountain codes](../explanation/fountain-codes.md).

## Contributing measurements

Have you measured a cell marked "community verification wanted", or found a better default for your hardware? A field report (device, distance, lighting, the settings that worked) is a hugely valuable PR: add a row to [compat.md](../compat.md) and, if it changes a default, note it here.
