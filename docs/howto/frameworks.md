# How-to: use it from React, Svelte, Vue, or vanilla

`<ur-scanner>` is a standard custom element, so every framework can render it. The one thing to get right is **where** you import the element module, because it registers a class that `extends HTMLElement` and that only exists in the browser.

## The SSR / dynamic-import gotcha (read this first)

`import '@nkwib/ur-scanner/element'` evaluates a class that extends `HTMLElement`. In a server render (Next.js, SvelteKit, Nuxt, Astro SSR) `HTMLElement` is undefined and the import throws. Two fixes, both standard:

1. Import the element only in a browser-only lifecycle hook (`useEffect`, `onMount`), or
2. Use the **headless core** (`@nkwib/ur-scanner`, which is SSR-safe) and render your own markup.

The core entry never touches the DOM at module scope, so importing `URReceiver` / `fromCamera` on the server is fine; only the `/element` subpath is browser-only.

## Vanilla

```html
<ur-scanner auto-start expected-type="bytes"></ur-scanner>
<script type="module">
  import '@nkwib/ur-scanner/element';
  document.querySelector('ur-scanner')
    .addEventListener('ur-complete', (e) => console.log(e.detail.cbor));
</script>
```

## React (incl. Next.js)

Import the element inside `useEffect` so it never runs during SSR. React passes unknown props as attributes and does not bind custom events, so attach the listener with a ref.

```tsx
import { useEffect, useRef } from 'react';
import type { DecodedUR } from '@nkwib/ur-scanner';

export function Scanner({ onBytes }: { onBytes: (ur: DecodedUR) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    import('@nkwib/ur-scanner/element').then(() => {
      if (cancelled) return;
      const el = ref.current!;
      const done = (e: Event) => onBytes((e as CustomEvent<DecodedUR>).detail);
      el.addEventListener('ur-complete', done);
    });
    return () => { cancelled = true; };
  }, [onBytes]);
  // @ts-expect-error custom element is not in JSX.IntrinsicElements
  return <ur-scanner ref={ref} auto-start expected-type="bytes" />;
}
```

## Svelte / SvelteKit

Custom-element events bind with `on:`. Guard the import for SSR with `browser` or `onMount`.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { DecodedUR } from '@nkwib/ur-scanner';
  let scanner: HTMLElement;
  onMount(async () => {
    await import('@nkwib/ur-scanner/element'); // browser-only
  });
  function complete(e: CustomEvent<DecodedUR>) {
    console.log(e.detail.cbor);
  }
</script>

<ur-scanner bind:this={scanner} auto-start expected-type="bytes" on:ur-complete={complete} />
```

In SvelteKit, `onMount` only runs in the browser, so the dynamic `import()` there is safe. If you import statically at the top of a component that renders on the server, the build breaks: use `onMount` or the `$app/environment` `browser` guard.

## Vue 3

Tell the compiler `ur-scanner` is a custom element, then use `@` listeners. Import the module in `onMounted`.

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import type { DecodedUR } from '@nkwib/ur-scanner';
onMounted(() => import('@nkwib/ur-scanner/element'));
const onComplete = (e: CustomEvent<DecodedUR>) => console.log(e.detail.cbor);
</script>

<template>
  <ur-scanner auto-start expected-type="bytes" @ur-complete="onComplete" />
</template>
```

```ts
// vite.config: treat the tag as a custom element so Vue does not warn
export default { plugins: [vue({ template: { compilerOptions: { isCustomElement: (t) => t === 'ur-scanner' } } })] };
```

## Prefer the headless core in any framework

If the built-in UI does not fit, skip the element and drive `fromCamera` yourself; it is SSR-safe to import and returns a controller you can wire to your own progress UI. See the [reference](../reference.md) and [`examples/headless.ts`](../../examples/headless.ts).
