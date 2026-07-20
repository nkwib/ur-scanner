<script>
  import { GITHUB_URL, NPM_URL } from '$lib/site.js';
  const year = new Date().getFullYear();
</script>

<footer class="footer">
  <div class="inner">
    <div class="meta">
      <span class="brand-mark">ur-scanner</span>
      <span class="dot" aria-hidden="true">·</span>
      <span class="muted">Browser receiver for animated BC-UR QR codes. Camera to bytes, no wallet required.</span>
    </div>
    <div class="links">
      <a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
      <a href={NPM_URL} target="_blank" rel="noopener">npm</a>
      <a href="{GITHUB_URL}/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>
    </div>
    <div class="copyright">© {year} · All processing is local · Built with SvelteKit</div>
  </div>
</footer>

<style>
  .footer {
    border-top: 1px solid var(--c-border);
    background: var(--c-bg-alt);
    margin-top: var(--sp-9);
    padding: var(--sp-6) var(--sp-5);
  }

  .inner {
    max-width: var(--wide-max);
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-4) var(--sp-6);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }

  .brand-mark {
    font-family: var(--font-mono);
    color: var(--c-text);
    font-weight: 600;
  }

  .dot {
    color: var(--c-text-subtle);
  }

  .links {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-5);
    margin-left: auto;
  }

  .links a {
    color: var(--c-text-muted);
    text-decoration: none;
    font-size: var(--fs-sm);
  }

  .links a:hover {
    color: var(--c-text);
    text-decoration: underline;
  }

  .copyright {
    color: var(--c-text-subtle);
    font-size: var(--fs-xs);
    flex-basis: 100%;
  }
</style>
