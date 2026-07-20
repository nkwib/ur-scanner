<script>
  import { onMount } from 'svelte';
  import { installBcUrGlobals } from '$lib/bc-ur-shim.js';
  import { GITHUB_URL } from '$lib/site.js';

  // Sender controls
  let payload = $state(
    'Uniform Resources make multi-KB transfer over a camera robust. This message is long enough to need several fountain-coded frames. Point your phone at the QR on the left, or press Simulate to watch it decode on this one device.'
  );
  let fragment = $state(40);
  let fps = $state(6);
  let ecc = $state('M');
  let fragCount = $state('...');
  let partLabel = $state('');

  // Receiver state
  let rxStatus = $state('Idle');
  let rxOut = $state('');
  let rxOutVisible = $state(false);
  let narration = $state('');
  let mode = $state('idle'); // 'idle' | 'camera' | 'fixture'

  // Capability / honest-degradation state
  let ready = $state(false);
  let cameraAvailable = $state(true);
  let insecure = $state(false);

  // DOM + module handles
  let canvasEl = $state(null);
  let scannerEl = $state(null);
  /** @type {{ UR: any, UREncoder: any, QRCode: any, Buffer: any } | null} */
  let mods = null;
  let encoder = null;
  let timer = null;
  let parts = [];

  onMount(() => {
    let disposed = false;
    (async () => {
      // Honest capability probe: camera needs a secure context + getUserMedia.
      insecure = window.isSecureContext === false;
      cameraAvailable = !insecure && Boolean(navigator.mediaDevices?.getUserMedia);

      // Install Buffer/process globals BEFORE bc-ur (and the element that pulls
      // it in) evaluate. This is the Vite equivalent of the demo's esbuild inject.
      const Buffer = await installBcUrGlobals();
      const [bcur, qrcodeMod] = await Promise.all([import('@ngraveio/bc-ur'), import('qrcode')]);
      await import('@blocco/ur-scanner/element'); // registers <ur-scanner>
      if (disposed) return;

      mods = { UR: bcur.UR, UREncoder: bcur.UREncoder, QRCode: qrcodeMod.default ?? qrcodeMod, Buffer };
      wireReceiver();
      startDisplay();
      ready = true;

      // If there is no camera path, guide the visitor straight to fixture mode.
      if (!cameraAvailable) {
        narration =
          'No camera is available here, so the demo runs in fixture mode: it replays the captured sequence and decodes it in-page. Press Simulate.';
      }
    })();

    return () => {
      disposed = true;
      stopDisplay();
      try {
        scannerEl?.stop?.();
      } catch (_) {}
    };
  });

  function wireReceiver() {
    const s = scannerEl;
    if (!s) return;
    s.addEventListener('ur-progress', (e) => {
      const p = e.detail;
      if (p.expectedPartCount) {
        rxStatus = `${Math.round(p.estimatedPercent * 100)}% · ${p.receivedParts}/${p.expectedPartCount} parts · seen ${p.framesSeen} frames`;
        narration =
          p.receivedParts <= 1
            ? 'The decoder joined the stream on whatever frame arrived first; with fountain codes there is no frame 1 to wait for.'
            : 'Each accepted frame carries fresh, mixed information, so order and drops do not matter. Progress is the decoder’s own estimate, not received ÷ total.';
      } else {
        rxStatus = 'Looking for an animated QR…';
      }
    });
    s.addEventListener('ur-complete', (e) => {
      const ur = e.detail;
      let text = '';
      try {
        text = new TextDecoder().decode(new Uint8Array(ur.decodeCbor()));
      } catch {
        text = '(binary payload)';
      }
      rxStatus = `Done: ${ur.cbor.length} bytes, type "${ur.type}"${ur.wasSinglePart ? ' (single-part; a static QR would have done)' : ''}`;
      rxOut = text;
      rxOutVisible = true;
      narration =
        'Complete. The payload was rebuilt from a set of frames a little larger than the original, never a fixed “1..N” run.';
    });
    s.addEventListener('ur-error', (e) => {
      rxStatus = `${e.detail.code}: ${e.detail.message}`;
      if (e.detail.code === 'INSECURE_CONTEXT' || e.detail.code?.startsWith('CAMERA')) {
        cameraAvailable = false;
        narration = 'The camera could not start. Fixture mode below runs the whole pipeline without one. Press Simulate.';
      }
    });
  }

  function buildEncoder() {
    const ur = mods.UR.fromBuffer(mods.Buffer.from(new TextEncoder().encode(payload)));
    encoder = new mods.UREncoder(ur, Number(fragment), 0);
    parts = [];
    fragCount = String(encoder.fragmentsLength);
  }

  async function renderFrame() {
    if (!encoder || !canvasEl) return;
    const part = encoder.nextPart();
    parts.push(part);
    if (parts.length > 200) parts.shift();
    await mods.QRCode.toCanvas(canvasEl, part.toUpperCase(), {
      errorCorrectionLevel: ecc,
      margin: 2,
      width: 320
    });
    partLabel = part.split('/').slice(0, 2).join('/') + '/…';
  }

  function startDisplay() {
    if (!mods) return;
    buildEncoder();
    stopDisplay();
    renderFrame();
    timer = setInterval(renderFrame, Math.round(1000 / Number(fps)));
  }

  function stopDisplay() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startCamera() {
    if (!scannerEl || !cameraAvailable) return;
    scannerEl.removeAttribute('fixture');
    mode = 'camera';
    rxOutVisible = false;
    scannerEl.start();
  }

  function simulate() {
    if (!scannerEl || !mods) return;
    if (parts.length < 3) {
      buildEncoder();
      for (let i = 0; i < encoder.fragmentsLength * 3; i++) parts.push(encoder.nextPart());
    }
    scannerEl.setAttribute('fixture', JSON.stringify(parts));
    mode = 'fixture';
    rxOutVisible = false;
    scannerEl.start();
  }

  function reset() {
    try {
      scannerEl?.stop?.();
    } catch (_) {}
    rxOutVisible = false;
    rxStatus = 'Idle';
    narration = '';
    mode = 'idle';
  }
</script>

<svelte:head>
  <title>Live demo · ur-scanner</title>
  <meta
    name="description"
    content="A live, in-browser demo: display an animated BC-UR QR and scan it back to bytes. Point a phone at a laptop, or run fixture mode on a single device. All processing is local."
  />
</svelte:head>

<div class="wrap">
  <header class="intro">
    <h1>Live demo</h1>
    <p class="lede">
      This one page both <strong>displays</strong> an animated UR and
      <strong>scans</strong> one, using the library's own
      <code>&lt;ur-scanner&gt;</code> element. Open it on a laptop, open the same
      URL on your phone, point the phone at the laptop, and watch the bytes
      transfer as the ring fills.
    </p>
    <p class="fixture-note">
      No second device? <strong>Fixture mode</strong> replays a captured frame
      sequence and decodes it in-page, so you get the full experience on a single
      device, no camera needed. All decoding is local; no frame ever leaves this
      page.
    </p>
    {#if insecure}
      <p class="warn-banner">
        This page is on an insecure origin, so the camera is disabled. Fixture
        mode still works. Press <strong>Simulate</strong>.
      </p>
    {/if}
  </header>

  <div class="grid">
    <section class="panel">
      <h2>Sender · animated UR</h2>
      <div class="qr-shell">
        <canvas bind:this={canvasEl} width="320" height="320" aria-label="Animated UR QR code"></canvas>
      </div>
      <p class="hint">{partLabel || 'Encoding…'}</p>
      <label>
        <span>Payload</span>
        <textarea bind:value={payload} rows="3"></textarea>
      </label>
      <div class="knobs">
        <label class="knob"><span>Fragment (bytes)</span><input type="number" min="10" max="400" bind:value={fragment} /></label>
        <label class="knob"><span>Display fps</span><input type="number" min="1" max="20" bind:value={fps} /></label>
        <label class="knob">
          <span>ECC</span>
          <select bind:value={ecc}><option>L</option><option>M</option><option>Q</option><option>H</option></select>
        </label>
      </div>
      <p class="hint">Source fragments: <strong>{fragCount}</strong>: the stream is rateless; it keeps emitting mixed frames.</p>
      <div class="row">
        <button class="btn primary" onclick={startDisplay} disabled={!ready}>Encode &amp; play</button>
        <button class="btn ghost" onclick={stopDisplay} disabled={!ready}>Stop</button>
      </div>
    </section>

    <section class="panel">
      <h2>Receiver · &lt;ur-scanner&gt;</h2>
      <div class="scanner-shell">
        <ur-scanner bind:this={scannerEl} id="scanner" expected-type="bytes"></ur-scanner>
      </div>
      <div class="row">
        <button class="btn primary" onclick={startCamera} disabled={!ready || !cameraAvailable} title={cameraAvailable ? '' : 'Camera unavailable on this origin/device'}>
          Start camera
        </button>
        <button class="btn accent" onclick={simulate} disabled={!ready}>Simulate (no camera)</button>
        <button class="btn ghost" onclick={reset} disabled={!ready}>Reset</button>
      </div>
      <p class="status" class:live={mode !== 'idle'}>{ready ? rxStatus : 'Loading the decoder…'}</p>
      {#if narration}
        <p class="narration">{narration}</p>
      {/if}
      {#if rxOutVisible}
        <pre class="out">{rxOut}</pre>
      {/if}
      {#if !cameraAvailable && ready}
        <p class="hint">Camera path unavailable here. That is expected on insecure origins or devices without a camera API. Fixture mode gives you the complete decode.</p>
      {/if}
    </section>
  </div>

  <section class="explainer">
    <h2>What you're watching</h2>
    <p>
      The sender chops your payload into <em>K</em> source fragments and emits an
      endless, fountain-coded stream of frames, each an XOR mix of several
      fragments. The receiver can start on any frame and finishes once it has
      collected a set of frames whose information adds up to the original,
      typically a little more than <em>K</em>. That is why the progress can jump,
      why a dropped frame is never fatal, and why there is no “frame 7 of 12” to
      wait for.
    </p>
    <p class="muted">
      Read the <a href="/docs/explanation/fountain-codes">fountain-codes explainer</a>
      for the worked example, or the <a href="/docs/reference">reference</a> for the
      <code>&lt;ur-scanner&gt;</code> attributes, events, and error taxonomy. The
      exact page you're on is a port of the package's own
      <a href="{GITHUB_URL}/tree/main/demo" target="_blank" rel="noopener">demo/</a>,
      importing the real published package.
    </p>
  </section>
</div>

<style>
  .wrap {
    max-width: var(--wide-max);
    margin: 0 auto;
    padding: var(--sp-7) var(--sp-5) var(--sp-8);
  }

  .intro {
    max-width: 52rem;
  }

  .intro h1 {
    font-size: var(--fs-2xl);
    margin: 0 0 var(--sp-3);
  }

  .lede {
    font-size: var(--fs-md);
    color: var(--c-text);
    margin: 0 0 var(--sp-3);
  }

  .fixture-note {
    color: var(--c-text-muted);
    background: var(--c-bg-alt);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--c-accent);
    border-radius: var(--r-md);
    padding: var(--sp-3) var(--sp-4);
    font-size: var(--fs-sm);
  }

  .warn-banner {
    color: var(--c-text);
    background: color-mix(in srgb, #d97706 14%, transparent);
    border: 1px solid color-mix(in srgb, #d97706 40%, transparent);
    border-radius: var(--r-md);
    padding: var(--sp-3) var(--sp-4);
    font-size: var(--fs-sm);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-5);
    margin: var(--sp-6) 0;
  }

  @media (max-width: 860px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .panel {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-5);
    box-shadow: var(--sh-sm);
  }

  .panel h2 {
    margin: 0 0 var(--sp-4);
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-text-subtle);
    font-family: var(--font-mono);
  }

  .qr-shell {
    display: grid;
    place-items: center;
    padding: var(--sp-3);
    background: var(--c-bg-alt);
    border-radius: var(--r-md);
  }

  canvas {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1 / 1;
    image-rendering: pixelated;
    background: #fff;
    border-radius: var(--r-sm);
    display: block;
  }

  .scanner-shell {
    display: grid;
    place-items: center;
  }

  ur-scanner {
    width: 100%;
    max-width: 340px;
  }

  label {
    display: block;
    margin: var(--sp-3) 0;
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
  }

  label > span {
    display: block;
    margin-bottom: var(--sp-1);
  }

  textarea,
  input,
  select {
    width: 100%;
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--c-text);
    background: var(--c-bg-alt);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-md);
    padding: var(--sp-2) var(--sp-3);
  }

  textarea {
    resize: vertical;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  .knobs {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--sp-3);
  }

  .knob {
    margin: var(--sp-2) 0;
  }

  .hint {
    color: var(--c-text-subtle);
    font-size: var(--fs-xs);
    margin: var(--sp-2) 0;
  }

  .row {
    display: flex;
    gap: var(--sp-2);
    flex-wrap: wrap;
    margin-top: var(--sp-3);
  }

  .btn {
    font: inherit;
    font-size: var(--fs-sm);
    font-weight: 600;
    padding: 0.5rem 0.9rem;
    border-radius: var(--r-md);
    border: 1px solid var(--c-border-strong);
    background: var(--c-bg-alt);
    color: var(--c-text);
    cursor: pointer;
    transition: filter 120ms ease, border-color 120ms ease, background 120ms ease;
  }

  .btn:hover:not(:disabled) {
    border-color: var(--c-accent);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.primary {
    background: var(--c-accent);
    color: var(--c-accent-fg);
    border-color: var(--c-accent);
  }

  .btn.accent {
    background: var(--c-accent-soft);
    color: var(--c-accent);
    border-color: var(--c-accent);
  }

  .btn.primary:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .status {
    margin-top: var(--sp-4);
    color: var(--c-text-muted);
    min-height: 1.5em;
    font-size: var(--fs-sm);
    font-family: var(--font-mono);
  }

  .status.live {
    color: var(--c-text);
  }

  .narration {
    margin-top: var(--sp-2);
    color: var(--c-accent);
    font-size: var(--fs-sm);
    line-height: 1.5;
  }

  .out {
    margin-top: var(--sp-3);
    padding: var(--sp-3);
    background: var(--c-bg-alt);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text);
  }

  .explainer {
    max-width: 52rem;
    margin-top: var(--sp-6);
    padding-top: var(--sp-5);
    border-top: 1px solid var(--c-border);
  }

  .explainer h2 {
    font-size: var(--fs-lg);
    margin: 0 0 var(--sp-3);
  }

  .explainer .muted {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
