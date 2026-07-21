<script>
  import { GITHUB_URL } from '$lib/site.js';
</script>

<svelte:head>
  <title>ur-scanner: receive animated BC-UR QR codes in the browser</title>
  <meta
    name="description"
    content="Camera to bytes, no wallet required. Fountain-coded animated UR makes multi-KB transfer robust on lossy cameras. The receiving end the web lacked, as a drop-in web component."
  />
</svelte:head>

<section class="hero">
  <div class="hero-grid">
    <div class="hero-copy">
      <span class="badge">
        <span class="dot" aria-hidden="true"></span>
        v0.1 · MIT · BC-UR receiver
      </span>
      <h1>
        Point a camera at an animated QR.
        <span class="accent">Get the bytes.</span>
      </h1>
      <p class="lede">
        A single QR caps out around <strong>3&nbsp;KB</strong>. Anything larger
        is split into an <strong>animated, fountain-coded</strong> sequence a
        camera can rebuild even while missing frames. Senders are everywhere;
        the browser lacked a good <strong>receiving</strong> end. This is that
        end: a pure decode core, pluggable frame sources, and a drop-in
        <code>&lt;ur-scanner&gt;</code> element.
      </p>

      <div class="cta">
        <a class="btn primary" href="/demo">
          Open the live demo
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
        <a class="btn ghost" href="/docs/explanation/fountain-codes">Why fountain codes?</a>
        <a class="btn ghost" href="/docs/tutorial">Docs</a>
      </div>

      <pre class="install"><span class="prompt">$</span> npm i @nkwib/ur-scanner @ngraveio/bc-ur</pre>
    </div>

    <aside class="shot">
      <div class="shot-chrome">
        <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="url">ur-scanner-docs.pages.dev/demo</span>
      </div>
      <div class="shot-body">
        <img src="/assets/demo.gif" alt="Animated demo: the sender cycles fountain-coded QR frames while the receiver ring fills and 156 bytes decode." width="820" height="623" />
        <span class="scanline" aria-hidden="true"></span>
      </div>
    </aside>
  </div>
</section>

<section class="pitch">
  <div class="pitch-inner">
    <div class="card">
      <div class="ic">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.6" /><path d="M8 8h3v3H8zM13 13h3v3h-3z" fill="currentColor" /></svg>
      </div>
      <h3>One QR is ~3&nbsp;KB</h3>
      <p>QR is a zero-infrastructure transport: no pairing, no network, works across an air gap and in a power cut. But a single code is tiny, so bigger payloads must animate.</p>
    </div>
    <div class="card">
      <div class="ic">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h4l3 7 4-14 3 7h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </div>
      <h3>Fountain-coded, loss-tolerant</h3>
      <p><a href="/docs/explanation/fountain-codes">BC-UR fountain-codes</a> the sequence: the receiver rebuilds the whole payload from <em>any</em> set of frames a bit larger than the original, and can join the stream at any point. Miss frame 7? It doesn't matter.</p>
    </div>
    <div class="card">
      <div class="ic">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v9m0 0l-3-3m3 3l3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /><rect x="4" y="16" width="16" height="4" rx="1.5" stroke="currentColor" stroke-width="1.6" /></svg>
      </div>
      <h3>The receiving end</h3>
      <p>Every hardware wallet ships a sender; the web had no good, framework-agnostic receiver. This is not a wallet library, it hands you bytes. Wallet payloads are <a href="/docs/howto/wallet-payloads">one recipe among many</a>.</p>
    </div>
  </div>
</section>

<section class="dropin">
  <div class="dropin-inner">
    <div class="dropin-copy">
      <h2>Drop-in web component</h2>
      <p>Import the browser-only subpath, add the tag, listen for <code>ur-complete</code>. Ten lines, any framework, or none.</p>
      <p class="muted">Prefer to own the loop? The <a href="/docs/reference">headless <code>URReceiver</code></a> core takes strings from a camera, a file, or a test fixture and is safe to import in SSR bundles.</p>
    </div>
    <div class="code-card">
      <div class="code-tab"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="fname">index.html</span></div>
      <pre class="code"><code><span class="tag">&lt;ur-scanner</span> <span class="attr">auto-start</span> <span class="attr">expected-type</span>=<span class="str">"bytes"</span><span class="tag">&gt;&lt;/ur-scanner&gt;</span>

<span class="tag">&lt;script</span> <span class="attr">type</span>=<span class="str">"module"</span><span class="tag">&gt;</span>
  <span class="kw">import</span> <span class="str">'@nkwib/ur-scanner/element'</span>;
  <span class="kw">const</span> scanner = document.<span class="fn">querySelector</span>(<span class="str">'ur-scanner'</span>);
  scanner.<span class="fn">addEventListener</span>(<span class="str">'ur-complete'</span>, (e) =&gt; &lbrace;
    <span class="cmt">// e.detail.cbor is a Uint8Array; payloads are just bytes.</span>
    console.<span class="fn">log</span>(<span class="str">`received $&lbrace;e.detail.cbor.length&rbrace; bytes`</span>);
    scanner.<span class="fn">stop</span>();
  &rbrace;);
<span class="tag">&lt;/script&gt;</span></code></pre>
    </div>
  </div>
</section>

<section class="privacy">
  <div class="privacy-inner">
    <div class="privacy-badge" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </div>
    <div>
      <h2>All processing is local. No telemetry.</h2>
      <p>
        No frame, byte, or pixel ever leaves the page. There is no network call
        of any kind. The camera stream goes to a canvas, the canvas to a QR
        detector, the strings to a decoder, all inside your tab. The library
        opens the camera only when you call <code>start()</code> and releases it
        on <code>stop()</code>. Even the fonts on this page are self-hosted.
      </p>
      <a class="lnk" href="{GITHUB_URL}/blob/main/SECURITY.md" target="_blank" rel="noopener">Read the security policy →</a>
    </div>
  </div>
</section>

<section class="support">
  <div class="support-inner">
    <h2>Browser support</h2>
    <p class="muted">The core decode logic runs anywhere JavaScript does. Camera and detection depend on the browser. Native <code>BarcodeDetector</code> is fastest; where it's missing, install <code>jsqr</code> and it loads lazily.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Browser</th><th>QR detection</th><th>Verified</th></tr>
        </thead>
        <tbody>
          <tr><td>Chrome / Edge (desktop + Android)</td><td>native <code>BarcodeDetector</code></td><td><span class="ok">yes</span> (Playwright/Chromium)</td></tr>
          <tr><td>Safari (macOS 14+, iOS 17+)</td><td><code>jsqr</code> fallback</td><td><span class="wip">help wanted</span></td></tr>
          <tr><td>Firefox</td><td><code>jsqr</code> fallback</td><td><span class="wip">help wanted</span></td></tr>
        </tbody>
      </table>
    </div>
    <p class="muted small">The honest, per-device matrix (a community-PR target) lives in the <a href="/docs/compat">compatibility docs</a>.</p>
  </div>
</section>

<section class="final">
  <div class="final-inner">
    <h2>See the bytes transfer</h2>
    <p>Open the demo on a laptop and your phone, point one at the other, and watch the ring fill. No second device? Fixture mode runs the whole pipeline on one screen.</p>
    <div class="cta center">
      <a class="btn primary big" href="/demo">Open the live demo →</a>
      <a class="btn ghost big" href="/docs/explanation/fountain-codes">The fountain-codes explainer</a>
    </div>
  </div>
</section>

<style>
  .hero {
    max-width: var(--wide-max);
    margin: 0 auto;
    padding: var(--sp-8) var(--sp-5) var(--sp-7);
  }

  .hero-grid {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: var(--sp-7);
    align-items: center;
  }

  @media (max-width: 960px) {
    .hero-grid {
      grid-template-columns: 1fr;
      gap: var(--sp-6);
    }
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    background: var(--c-bg-alt);
    border: 1px solid var(--c-border);
    padding: 4px var(--sp-3);
    border-radius: 999px;
    margin-bottom: var(--sp-4);
  }

  .badge .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c-accent);
    box-shadow: 0 0 0 3px var(--c-accent-soft);
  }

  h1 {
    font-size: var(--fs-3xl);
    line-height: 1.08;
    margin: 0 0 var(--sp-4);
    letter-spacing: -0.035em;
  }

  .accent {
    color: var(--c-accent);
  }

  .lede {
    font-size: var(--fs-md);
    color: var(--c-text-muted);
    margin: 0 0 var(--sp-5);
    max-width: 34rem;
  }

  .lede code {
    font-size: 0.9em;
  }

  .cta {
    display: inline-flex;
    gap: var(--sp-3);
    margin-bottom: var(--sp-5);
    flex-wrap: wrap;
  }

  .cta.center {
    justify-content: center;
    margin-bottom: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0.6rem 1rem;
    border-radius: var(--r-md);
    font-size: var(--fs-sm);
    font-weight: 600;
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease, filter 120ms ease;
  }

  .btn.big {
    padding: 0.75rem 1.3rem;
    font-size: var(--fs-base);
  }

  .btn.primary {
    background: var(--c-accent);
    color: var(--c-accent-fg);
    border: 1px solid var(--c-accent);
  }

  .btn.primary:hover {
    text-decoration: none;
    filter: brightness(1.08);
  }

  .btn.ghost {
    background: var(--c-bg-alt);
    color: var(--c-text);
    border: 1px solid var(--c-border-strong);
  }

  .btn.ghost:hover {
    background: var(--c-surface-2);
    border-color: var(--c-accent);
    text-decoration: none;
  }

  .install {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--c-code-bg);
    border: 1px solid var(--c-border);
    color: var(--c-code-text);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-md);
    margin: 0;
    display: inline-block;
    overflow-x: auto;
    max-width: 100%;
  }

  .install .prompt {
    color: var(--c-accent);
    margin-right: var(--sp-2);
  }

  /* Screenshot with browser chrome + a sweeping scan line */
  .shot {
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    overflow: hidden;
    box-shadow: var(--sh-lg);
    background: var(--c-surface);
  }

  .shot-chrome {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    background: var(--c-bg-alt);
  }

  .dots {
    display: inline-flex;
    gap: 6px;
  }

  .dots i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c-border-strong);
  }

  .url {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-subtle);
  }

  .shot-body {
    position: relative;
    line-height: 0;
  }

  .shot-body img {
    width: 100%;
    height: auto;
    display: block;
  }

  .scanline {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--c-accent), transparent);
    box-shadow: 0 0 12px 2px color-mix(in srgb, var(--c-accent) 60%, transparent);
    animation: sweep 3.6s ease-in-out infinite;
    opacity: 0.85;
  }

  @keyframes sweep {
    0%, 100% { top: 6%; }
    50% { top: 94%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .scanline { animation: none; top: 50%; opacity: 0.4; }
  }

  /* Pitch cards */
  .pitch {
    border-top: 1px solid var(--c-border);
    border-bottom: 1px solid var(--c-border);
    background: var(--c-bg-alt);
    padding: var(--sp-7) var(--sp-5);
  }

  .pitch-inner {
    max-width: var(--wide-max);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-6);
  }

  @media (max-width: 800px) {
    .pitch-inner {
      grid-template-columns: 1fr;
    }
  }

  .card h3 {
    font-size: var(--fs-md);
    margin: 0 0 var(--sp-2);
  }

  .card p {
    color: var(--c-text-muted);
    margin: 0;
    font-size: var(--fs-sm);
  }

  .ic {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--c-accent);
    background: var(--c-accent-soft);
    border-radius: var(--r-md);
    margin-bottom: var(--sp-3);
  }

  .ic svg {
    width: 22px;
    height: 22px;
  }

  /* Drop-in */
  .dropin {
    max-width: var(--wide-max);
    margin: 0 auto;
    padding: var(--sp-8) var(--sp-5);
  }

  .dropin-inner {
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: var(--sp-7);
    align-items: center;
  }

  @media (max-width: 900px) {
    .dropin-inner {
      grid-template-columns: 1fr;
      gap: var(--sp-5);
    }
  }

  .dropin h2 {
    font-size: var(--fs-2xl);
    margin: 0 0 var(--sp-3);
  }

  .dropin p {
    color: var(--c-text);
    margin: 0 0 var(--sp-3);
  }

  .muted {
    color: var(--c-text-muted);
  }

  .code-card {
    background: var(--c-code-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    overflow: hidden;
    box-shadow: var(--sh-md);
  }

  .code-tab {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    background: var(--c-bg-alt);
  }

  .fname {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-subtle);
  }

  .code {
    margin: 0;
    padding: var(--sp-4) var(--sp-5);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.65;
    color: var(--c-code-text);
    overflow-x: auto;
  }

  .code .tag { color: var(--c-code-tag); }
  .code .attr { color: var(--c-code-prop); }
  .code .str { color: var(--c-code-string); }
  .code .kw { color: var(--c-code-keyword); font-weight: 500; }
  .code .fn { color: var(--c-code-fn); }
  .code .cmt { color: var(--c-code-comment); font-style: italic; }

  /* Privacy */
  .privacy {
    background: var(--c-accent-soft);
    border-top: 1px solid var(--c-border);
    border-bottom: 1px solid var(--c-border);
    padding: var(--sp-7) var(--sp-5);
  }

  .privacy-inner {
    max-width: var(--wide-max);
    margin: 0 auto;
    display: flex;
    gap: var(--sp-5);
    align-items: flex-start;
  }

  .privacy-badge {
    flex: none;
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    color: var(--c-accent);
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
  }

  .privacy-badge svg {
    width: 28px;
    height: 28px;
  }

  .privacy h2 {
    font-size: var(--fs-xl);
    margin: 0 0 var(--sp-3);
  }

  .privacy p {
    color: var(--c-text);
    max-width: 52rem;
    margin: 0 0 var(--sp-3);
  }

  .lnk {
    font-weight: 600;
    font-size: var(--fs-sm);
  }

  /* Support */
  .support {
    max-width: var(--wide-max);
    margin: 0 auto;
    padding: var(--sp-8) var(--sp-5) var(--sp-6);
  }

  .support h2 {
    font-size: var(--fs-2xl);
    margin: 0 0 var(--sp-3);
  }

  .support .muted {
    max-width: 46rem;
  }

  .support .small {
    font-size: var(--fs-sm);
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    margin: var(--sp-4) 0;
  }

  .support table {
    margin: 0;
  }

  .support th,
  .support td {
    padding: var(--sp-3) var(--sp-4);
  }

  .ok {
    color: var(--c-good);
    font-weight: 600;
  }

  .wip {
    color: var(--c-text-subtle);
    font-style: italic;
  }

  /* Final CTA */
  .final {
    max-width: var(--wide-max);
    margin: 0 auto;
    padding: var(--sp-7) var(--sp-5) var(--sp-8);
    text-align: center;
  }

  .final h2 {
    font-size: var(--fs-2xl);
    margin: 0 0 var(--sp-3);
  }

  .final p {
    color: var(--c-text-muted);
    max-width: 40rem;
    margin: 0 auto var(--sp-5);
  }
</style>
