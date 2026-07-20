<script>
  let { size = 28, wordmark = true } = $props();
</script>

<span class="logo">
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    aria-hidden="true"
    role="img"
    fill="none"
  >
    <!-- QR finder-pattern corners + a cyan scan line sweeping the module field. -->
    <rect x="3" y="3" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.8" />
    <rect x="6" y="6" width="3" height="3" rx="0.5" fill="currentColor" />
    <rect x="20" y="3" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.8" />
    <rect x="23" y="6" width="3" height="3" rx="0.5" fill="currentColor" />
    <rect x="3" y="20" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.8" />
    <rect x="6" y="23" width="3" height="3" rx="0.5" fill="currentColor" />
    <!-- data modules -->
    <rect x="20" y="20" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.55" />
    <rect x="26" y="20" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.55" />
    <rect x="23" y="26" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.55" />
    <!-- scan beam -->
    <line x1="2" y1="16" x2="30" y2="16" stroke="var(--c-accent)" stroke-width="1.8" stroke-linecap="round" />
  </svg>
  {#if wordmark}
    <span class="wordmark">ur-scanner</span>
  {/if}
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--c-text);
    font-weight: 600;
    letter-spacing: -0.02em;
    font-size: 1.05rem;
  }

  .wordmark {
    font-family: var(--font-mono);
    font-size: 0.95rem;
  }
</style>
