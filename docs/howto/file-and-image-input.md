# How-to: file and image input (the no-camera path)

Not every user can grant a camera: locked-down desktops, kiosk browsers, denied permissions, or someone who just took a screenshot of the animated QR. `fromImage` decodes QR codes out of a still image, so you always have a fallback.

## Single image

```ts
import { fromImage } from '@blocco/ur-scanner';

const input = document.querySelector('input[type=file]') as HTMLInputElement;
input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  const { progress, found } = await fromImage(file, { expectedType: 'bytes' });
  console.log(`found ${found.length} code(s), complete=${progress.complete}`);
});
```

`source` accepts a `Blob`, a `File`, an `ImageBitmap`, an `<img>`, a `<canvas>`, or a URL string. Large photos are downscaled to `maxSize` (default 2000px on the longer side) before detection to keep it fast; raise it if dense codes are being missed.

## Multi-part payloads from several screenshots

A single still holds one frame of an animated UR, which is rarely enough. Because UR is fountain-coded, a handful of screenshots taken at different moments is plenty. Thread one `receiver` across the calls so state accumulates:

```ts
import { URReceiver, fromImage } from '@blocco/ur-scanner';

const receiver = new URReceiver({ expectedType: 'bytes', onComplete: (ur) => use(ur.cbor) });
for (const file of Array.from(input.files ?? [])) {
  const { progress } = await fromImage(file, { receiver });
  if (progress.complete) break;
}
```

## Paste and drag-drop

The same `fromImage` handles a pasted or dropped image; just pull the `Blob` out of the event:

```ts
window.addEventListener('paste', async (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
  const blob = item?.getAsFile();
  if (blob) await fromImage(blob, { receiver });
});
```

## Notes

- Detection uses the same [detector seam](../reference.md#detector-seam) as the camera: native `BarcodeDetector` where available, else lazily-loaded `jsqr`. Install `jsqr` if you must support Safari/Firefox for image input.
- `fromImage` reads pixels with `getImageData`, so cross-origin image URLs must be CORS-enabled or the canvas taints and detection throws. Prefer passing a `Blob`/`File`.
- One still can contain several distinct QR codes; all are detected and fed, and non-UR ones are ignored (reason `not-a-ur`).
