/**
 * Client-side, lazily-loaded mermaid rendering for the generated doc pages.
 * The prebuild emits ```mermaid fences as <pre class="mermaid">…</pre>; this
 * module turns them into SVG on mount, re-renders on theme change, and never
 * ships mermaid in the initial bundle (dynamic import).
 */
let mermaidPromise;

function loadMermaid() {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  return mermaidPromise;
}

function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Render (or re-render, theme-aware) every mermaid block under `root`. */
export async function renderMermaid(root) {
  const scope = root ?? document;
  const nodes = Array.from(scope.querySelectorAll('pre.mermaid, .mermaid'));
  if (nodes.length === 0) return;

  const mermaid = await loadMermaid();
  const dark = currentTheme() === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: dark ? 'dark' : 'default',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    themeVariables: dark
      ? { primaryColor: '#0f151e', primaryBorderColor: '#22d3ee', lineColor: '#64748b', primaryTextColor: '#e6edf3' }
      : { primaryColor: '#ecfeff', primaryBorderColor: '#0891b2', lineColor: '#94a3b8', primaryTextColor: '#0f172a' }
  });

  for (const node of nodes) {
    // Keep the original graph source so a theme switch can re-render.
    if (node.dataset.src == null) node.dataset.src = node.textContent ?? '';
    else node.textContent = node.dataset.src;
    node.removeAttribute('data-processed');
  }

  try {
    await mermaid.run({ nodes });
  } catch (err) {
    console.warn('[mermaid] render failed', err);
  }
}

/**
 * Call `cb` whenever the site theme changes (the ThemeToggle stamps
 * `data-theme` on <html>). Returns a cleanup function.
 */
export function watchThemeChanges(cb) {
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'data-theme')) cb();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
