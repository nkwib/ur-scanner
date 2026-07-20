# Compatibility matrix

Honest, community-maintained interop. Rows are only marked verified when someone actually ran it. **Adding a verified row is the canonical first contribution** (see [CONTRIBUTING](../CONTRIBUTING.md)); the "Verified by" column is what makes this trustworthy, so please fill it with a real handle and date.

## Browsers (QR detection path)

| Browser | Platform | Detector | Works | Verified by |
| --- | --- | --- | --- | --- |
| Chrome | macOS / Windows / Linux | native `BarcodeDetector` | yes | maintainers, Playwright/Chromium smoke, 2026-02 |
| Chrome | Android | native `BarcodeDetector` | expected | community verification wanted |
| Edge | Windows | native `BarcodeDetector` | expected | community verification wanted |
| Safari | macOS 14+ | `jsqr` fallback | expected | community verification wanted |
| Safari | iOS 17+ | `jsqr` fallback | expected | community verification wanted |
| Firefox | any | `jsqr` fallback | expected | community verification wanted |
| Samsung Internet | Android | native `BarcodeDetector` | expected | community verification wanted |

Notes: "native" means the browser ships `BarcodeDetector` with `qr_code` support and the library uses it directly (fastest). "fallback" means you must install the optional `jsqr` peer; the library loads it lazily. "expected" is a reasoned guess, not a test.

## Senders / hardware devices

The decode core is verified against `@ngraveio/bc-ur`'s own `UREncoder`. Physical wallet interop is **untested by the maintainers**. If you scan a real device, record the settings that worked (they matter as much as the yes/no).

| Sender | Payload type | Fragment / fps observed | Works | Verified by |
| --- | --- | --- | --- | --- |
| `@ngraveio/bc-ur` `UREncoder` | `bytes` | any | yes | maintainers, unit + e2e, 2026-02 |
| Keystone | `crypto-psbt` / `crypto-account` | ? | unknown | community verification wanted |
| Blockchain Commons reference (seedtool) | `crypto-seed` | ? | unknown | community verification wanted |
| Sparrow / Nunchuk (as sender) | `crypto-psbt` | ? | unknown | community verification wanted |
| Foundation Passport | `crypto-psbt` | ? | unknown | community verification wanted |

## How to add a row

1. Run the [demo](../demo/) (two-device mode) or your own integration against the target.
2. Note browser + version, device, and, for senders, the fragment size / fps / ECC that worked.
3. Edit the relevant table: set "Works" honestly (yes / no / partial) and put your GitHub handle + date in "Verified by".
4. Open a PR. Even a "no, fails like this" row is valuable.
