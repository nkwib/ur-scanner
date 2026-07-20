<script>
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>{$page.status} · ur-scanner</title>
</svelte:head>

<section class="err">
  <div class="code">{$page.status}</div>
  <h1>{$page.status === 404 ? 'Lost the signal' : 'Something went wrong'}</h1>
  <p>
    {$page.status === 404
      ? "That page could not be decoded. The frame you were looking for isn't in the stream."
      : ($page.error?.message ?? 'An unexpected error occurred.')}
  </p>
  <div class="actions">
    <a class="btn primary" href="/">Back home</a>
    <a class="btn ghost" href="/docs/tutorial">Read the docs</a>
  </div>
</section>

<style>
  .err {
    max-width: 34rem;
    margin: 0 auto;
    padding: var(--sp-9) var(--sp-5);
    text-align: center;
  }

  .code {
    font-family: var(--font-mono);
    font-size: var(--fs-4xl);
    font-weight: 700;
    color: var(--c-accent);
    letter-spacing: 0.05em;
  }

  h1 {
    font-size: var(--fs-2xl);
    margin: var(--sp-3) 0;
  }

  p {
    color: var(--c-text-muted);
    margin-bottom: var(--sp-5);
  }

  .actions {
    display: inline-flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn {
    padding: 0.6rem 1rem;
    border-radius: var(--r-md);
    font-size: var(--fs-sm);
    font-weight: 600;
    text-decoration: none;
  }

  .btn.primary {
    background: var(--c-accent);
    color: var(--c-accent-fg);
    border: 1px solid var(--c-accent);
  }

  .btn.ghost {
    background: var(--c-bg-alt);
    color: var(--c-text);
    border: 1px solid var(--c-border-strong);
  }

  .btn:hover {
    text-decoration: none;
    filter: brightness(1.05);
  }
</style>
