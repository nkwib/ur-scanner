/**
 * docs:gen — the single-source-of-truth markdown pipeline.
 *
 * The repo's own docs/*.md and README are the ONLY place doc content lives. This
 * script transforms them into routed pages at build time; editing docs/*.md is
 * how the site updates. Nothing here forks or rewrites that content.
 *
 * Why remark/rehype -> {@html} instead of mdsvex `.svx`: mdsvex parses `{...}`
 * and `<...>` in prose as Svelte, so arbitrary markdown edits would need
 * brace-escaping to keep the build green. A plain markdown->HTML transform keeps
 * the docs authorable as ordinary markdown by anyone.
 *
 * Pipeline: GFM tables, Prism-highlighted fences (ts/js/bash/json/html/...),
 * ```mermaid``` fences emitted as theme-aware client-rendered blocks, relative
 * inter-doc links rewritten to site routes, images copied into static/, and any
 * other repo-file link falling back to a GitHub blob/tree URL.
 */
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import GithubSlugger from 'github-slugger';

const require = createRequire(import.meta.url);
const Prism = require('prismjs');
const loadLanguages = require('prismjs/components/');
loadLanguages(['markup', 'css', 'clike', 'javascript', 'typescript', 'tsx', 'json', 'bash', 'diff', 'yaml']);
const PRISM_ALIASES = { ts: 'typescript', js: 'javascript', sh: 'bash', shell: 'bash', console: 'bash' };

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(here, '..');
const repoRoot = join(siteRoot, '..');
const REPO_URL = 'https://github.com/nkwib/ur-scanner';
const REPO_BRANCH = 'main';

const generatedDir = join(siteRoot, 'src', 'lib', 'generated');
const assetsDir = join(siteRoot, 'static', 'assets');
mkdirSync(generatedDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

/** Diataxis-ordered doc set. `src` is repo-relative; `slug` is the site route. */
const DOCS = [
  { src: 'docs/tutorial.md', slug: 'tutorial', group: 'Tutorial', label: 'Tutorial' },
  { src: 'docs/howto/frameworks.md', slug: 'howto/frameworks', group: 'How-to', label: 'Frameworks' },
  { src: 'docs/howto/file-and-image-input.md', slug: 'howto/file-and-image-input', group: 'How-to', label: 'File & image input' },
  { src: 'docs/howto/camera-selection-and-torch.md', slug: 'howto/camera-selection-and-torch', group: 'How-to', label: 'Camera & torch' },
  { src: 'docs/howto/tuning.md', slug: 'howto/tuning', group: 'How-to', label: 'Physical tuning' },
  { src: 'docs/howto/testing.md', slug: 'howto/testing', group: 'How-to', label: 'Testing (no camera)' },
  { src: 'docs/howto/wallet-payloads.md', slug: 'howto/wallet-payloads', group: 'How-to', label: 'Wallet payloads' },
  { src: 'docs/reference.md', slug: 'reference', group: 'Reference', label: 'API reference' },
  { src: 'docs/explanation/fountain-codes.md', slug: 'explanation/fountain-codes', group: 'Explanation', label: 'Fountain codes' },
  { src: 'docs/explanation/architecture.md', slug: 'explanation/architecture', group: 'Explanation', label: 'Architecture' },
  { src: 'docs/compat.md', slug: 'compat', group: 'Compatibility', label: 'Compatibility' }
];

/** repo path (normalized, .md) -> site slug, for inter-doc link rewriting. */
const pathToSlug = new Map(DOCS.map((d) => [posix.normalize(d.src), d.slug]));

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(code, lang) {
  const language = PRISM_ALIASES[lang] || lang || 'plain';
  const grammar = Prism.languages[language];
  const html = grammar ? Prism.highlight(code, grammar, language) : escapeHtml(code);
  return `<pre class="code-block language-${language}" data-lang="${language}"><code class="language-${language}">${html}</code></pre>`;
}

const copiedImages = new Set();

/** Resolve a repo-relative asset, copy it into static/assets, return the web path. */
function resolveImage(srcRef, docDir) {
  const clean = srcRef.split('#')[0].split('?')[0];
  const repoRel = posix.normalize(posix.join(docDir, clean));
  const abs = join(repoRoot, repoRel);
  const base = posix.basename(repoRel);
  if (!copiedImages.has(repoRel)) {
    if (existsSync(abs)) copyFileSync(abs, join(assetsDir, base));
    else console.warn(`docs:gen  image not found, left as-is: ${repoRel}`);
    copiedImages.add(repoRel);
  }
  return `/assets/${base}`;
}

/** Turn a repo-relative link into a site route (if it targets a doc) or a GitHub URL. */
function resolveLink(href, docDir) {
  if (/^(https?:)?\/\//.test(href) || /^(mailto:|tel:)/.test(href) || href.startsWith('#')) return null;
  const [pathPart, hash] = href.split('#');
  const hashSuffix = hash ? `#${hash}` : '';
  const repoRel = posix.normalize(posix.join(docDir, pathPart));
  if (pathToSlug.has(repoRel)) return `/docs/${pathToSlug.get(repoRel)}${hashSuffix}`;
  // Not a doc page: fall back to GitHub. Directories -> /tree, files -> /blob.
  const trimmed = repoRel.replace(/\/$/, '');
  const kind = pathPart.endsWith('/') || extname(trimmed) === '' ? 'tree' : 'blob';
  return `${REPO_URL}/${kind}/${REPO_BRANCH}/${trimmed}${hashSuffix}`;
}

/** rehype transformer: heading ids, code/mermaid, links, images. */
function transform(docDir) {
  return (tree) => {
    const slugger = new GithubSlugger();

    visit(tree, 'element', (node, index, parent) => {
      // Headings -> stable ids for in-page and cross-doc `#anchor` links.
      if (/^h[1-6]$/.test(node.tagName) && !node.properties?.id) {
        node.properties = node.properties || {};
        node.properties.id = slugger.slug(hastToString(node));
        return;
      }

      // Code fences: mermaid -> client-rendered block; everything else -> Prism.
      if (node.tagName === 'pre' && node.children?.[0]?.tagName === 'code') {
        const code = node.children[0];
        const classes = code.properties?.className || [];
        const langClass = classes.find((c) => typeof c === 'string' && c.startsWith('language-'));
        const lang = langClass ? langClass.slice('language-'.length) : '';
        const raw = hastToString(code);
        if (lang === 'mermaid') {
          // textContent must equal the exact fence bytes so mermaid decodes the
          // author's HTML entities (e.g. &lt;ur-scanner&gt;) itself.
          replaceWithRaw(node, `<pre class="mermaid">${escapeHtml(raw)}</pre>`);
        } else {
          replaceWithRaw(node, highlight(raw, lang));
        }
        return;
      }

      // Links: rewrite relative repo links; harden external ones.
      if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
        const rewritten = resolveLink(node.properties.href, docDir);
        if (rewritten) node.properties.href = rewritten;
        if (/^https?:\/\//.test(node.properties.href)) {
          node.properties.target = '_blank';
          node.properties.rel = 'noopener noreferrer';
        }
        return;
      }

      // Images: copy into static/assets and point at the web path.
      if (node.tagName === 'img' && typeof node.properties?.src === 'string' && !/^https?:\/\//.test(node.properties.src)) {
        node.properties.src = resolveImage(node.properties.src, docDir);
        node.properties.loading = 'lazy';
      }
    });
  };
}

function replaceWithRaw(node, html) {
  node.type = 'raw';
  node.value = html;
  delete node.tagName;
  delete node.children;
  delete node.properties;
}

/** First h1 text (page title) and first paragraph text (meta description). */
function extractMeta(markdown) {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1].trim() : 'Documentation';
  const body = markdown.replace(/^#\s+.+$/m, '').replace(/```[\s\S]*?```/g, '');
  const para = body.split(/\n{2,}/).map((s) => s.trim()).find((s) => s && !s.startsWith('#') && !s.startsWith('!') && !s.startsWith('|'));
  const description = (para || title).replace(/[*_`>[\]]/g, '').replace(/\(([^)]*)\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
  return { title, description };
}

async function renderDoc(doc) {
  const abs = join(repoRoot, doc.src);
  const markdown = readFileSync(abs, 'utf8');
  const docDir = posix.dirname(posix.normalize(doc.src));
  const { title, description } = extractMeta(markdown);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(() => transform(docDir))
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return { slug: doc.slug, group: doc.group, label: doc.label, title, description, html: String(file) };
}

// ── Build ─────────────────────────────────────────────────────────────────────
const rendered = [];
for (const doc of DOCS) rendered.push(await renderDoc(doc));

// Landing + README parity: always make the demo screenshot available.
if (existsSync(join(repoRoot, 'docs/assets/demo.png'))) {
  copyFileSync(join(repoRoot, 'docs/assets/demo.png'), join(assetsDir, 'demo.png'));
}
// The animated hero (captured by scripts/capture-gif.mjs, stored out of the npm tarball).
if (existsSync(join(repoRoot, '.github/assets/demo.gif'))) {
  copyFileSync(join(repoRoot, '.github/assets/demo.gif'), join(assetsDir, 'demo.gif'));
}

// docs.json: slug -> page (with prev/next for footer navigation).
const docsOut = {};
rendered.forEach((page, i) => {
  const prev = rendered[i - 1];
  const next = rendered[i + 1];
  docsOut[page.slug] = {
    title: page.title,
    description: page.description,
    group: page.group,
    label: page.label,
    html: page.html,
    prev: prev ? { slug: prev.slug, label: prev.label } : null,
    next: next ? { slug: next.slug, label: next.label } : null
  };
});

// nav.json: sidebar sections in Diataxis order.
const sections = [];
for (const page of rendered) {
  let section = sections.find((s) => s.label === page.group);
  if (!section) sections.push((section = { label: page.group, items: [] }));
  section.items.push({ href: `/docs/${page.slug}`, label: page.label });
}

writeFileSync(join(generatedDir, 'docs.json'), JSON.stringify(docsOut));
writeFileSync(join(generatedDir, 'nav.json'), JSON.stringify(sections));

console.log(`docs:gen  ${rendered.length} pages -> src/lib/generated/{docs,nav}.json`);
console.log(`docs:gen  images copied: ${[...copiedImages].join(', ') || '(none in docs)'} + demo.png`);
