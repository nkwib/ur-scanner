<script>
  import { page } from '$app/stores';

  /** @type {{ sections: { label: string, items: { href: string, label: string }[] }[] }} */
  let { sections } = $props();

  let open = $state(false);

  // Close the drawer whenever the route changes.
  let path = $derived($page.url.pathname);
  $effect(() => {
    path;
    open = false;
  });

  function isActive(href) {
    const pathname = $page.url.pathname;
    const [base] = href.split('#');
    return pathname === base;
  }
</script>

<button class="drawer-toggle" type="button" aria-expanded={open} onclick={() => (open = !open)}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  </svg>
  Documentation
</button>

{#if open}
  <button class="scrim" aria-label="Close navigation" onclick={() => (open = false)}></button>
{/if}

<aside class="sidebar" class:open aria-label="Section navigation">
  <nav>
    {#each sections as section (section.label)}
      <div class="group">
        <div class="group-label">{section.label}</div>
        <ul>
          {#each section.items as item (item.href)}
            <li>
              <a class="item" class:active={isActive(item.href)} href={item.href}>
                {item.label}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
</aside>

<style>
  .sidebar {
    position: sticky;
    top: var(--header-h);
    align-self: start;
    max-height: calc(100vh - var(--header-h));
    overflow-y: auto;
    padding: var(--sp-6) var(--sp-3) var(--sp-7);
  }

  .group + .group {
    margin-top: var(--sp-5);
  }

  .group-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--c-text-subtle);
    padding: 0 var(--sp-3);
    margin-bottom: var(--sp-2);
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin: 0;
  }

  .item {
    display: block;
    padding: 6px var(--sp-3);
    color: var(--c-text-muted);
    text-decoration: none;
    font-size: var(--fs-sm);
    border-radius: var(--r-md);
    border-left: 2px solid transparent;
    transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
    line-height: 1.4;
  }

  .item:hover {
    color: var(--c-text);
    background: var(--c-bg-alt);
    text-decoration: none;
  }

  .item.active {
    color: var(--c-accent);
    background: var(--c-accent-soft);
    border-left-color: var(--c-accent);
    font-weight: 500;
  }

  .drawer-toggle {
    display: none;
  }

  @media (max-width: 960px) {
    .drawer-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      margin: var(--sp-4) 0 var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      font: inherit;
      font-size: var(--fs-sm);
      font-weight: 500;
      color: var(--c-text);
      background: var(--c-surface);
      border: 1px solid var(--c-border-strong);
      border-radius: var(--r-md);
      cursor: pointer;
    }

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgba(2, 6, 23, 0.5);
      border: 0;
      cursor: pointer;
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 70;
      width: min(82vw, 20rem);
      max-height: 100vh;
      height: 100%;
      background: var(--c-surface);
      border-right: 1px solid var(--c-border);
      box-shadow: var(--sh-lg);
      transform: translateX(-100%);
      transition: transform 180ms ease;
      padding-top: var(--sp-6);
    }

    .sidebar.open {
      transform: translateX(0);
    }
  }
</style>
