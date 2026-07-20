<script>
  import { onMount, tick } from 'svelte';
  import { renderMermaid, watchThemeChanges } from '$lib/mermaid.js';

  let { data } = $props();
  let doc = $derived(data.doc);

  let articleEl = $state(null);

  // Re-run mermaid whenever the rendered doc changes (client navigation) or the
  // theme flips.
  onMount(() => {
    const rerun = () => renderMermaid(articleEl ?? undefined);
    const stopWatch = watchThemeChanges(rerun);
    return stopWatch;
  });

  $effect(() => {
    // Depend on the current slug so this re-runs on navigation.
    data.slug;
    tick().then(() => renderMermaid(articleEl ?? undefined));
  });
</script>

<svelte:head>
  <title>{doc.title} · ur-scanner</title>
  <meta name="description" content={doc.description} />
</svelte:head>

<div class="doc-content" bind:this={articleEl}>
  {@html doc.html}
</div>

<nav class="pager" aria-label="Documentation pages">
  {#if doc.prev}
    <a class="pager-link prev" href={'/docs/' + doc.prev.slug}>
      <span class="dir">← Previous</span>
      <span class="label">{doc.prev.label}</span>
    </a>
  {:else}
    <span></span>
  {/if}
  {#if doc.next}
    <a class="pager-link next" href={'/docs/' + doc.next.slug}>
      <span class="dir">Next →</span>
      <span class="label">{doc.next.label}</span>
    </a>
  {/if}
</nav>

<style>
  .pager {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-4);
    margin-top: var(--sp-8);
    padding-top: var(--sp-5);
    border-top: 1px solid var(--c-border);
  }

  .pager-link {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: var(--c-surface);
    text-decoration: none;
    max-width: 48%;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .pager-link:hover {
    border-color: var(--c-accent);
    text-decoration: none;
    background: var(--c-bg-alt);
  }

  .pager-link.next {
    text-align: right;
    margin-left: auto;
  }

  .dir {
    font-size: var(--fs-xs);
    color: var(--c-text-subtle);
    font-family: var(--font-mono);
  }

  .label {
    color: var(--c-text);
    font-weight: 550;
    font-size: var(--fs-sm);
  }
</style>
