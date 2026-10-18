// HTML -> Markdown: selector/strip handling, turndown (clean fragments) or defuddle (whole pages).
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { stripSection } from './frontmatter.mjs';

let turndownInstance = null;

function cellText(td, cell) {
  return td.turndown(cell.innerHTML || '').replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

function getTurndown() {
  if (turndownInstance) return turndownInstance;
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '_' });
  // Keep identifiers greppable (get_field, not get\_field): no markdown escaping of text.
  td.escape = (text) => text;
  td.remove(['script', 'style', 'noscript', 'iframe', 'form', 'button']);
  // Fenced code with the language taken from class="language-x".
  td.addRule('fencedLang', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_content, node) => {
      const code = node.querySelector('code') || node;
      const cls = (code.getAttribute?.('class') || '') + ' ' + (node.getAttribute?.('class') || '');
      const lang = (/(?:language|lang)-([\w+-]+)/.exec(cls) || [])[1] || '';
      const text = (code.textContent || '').replace(/\n$/, '');
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    },
  });
  // Minimal GFM tables.
  td.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const rows = Array.from(node.querySelectorAll("tr"));
      if (rows.length === 0) return '';
      const matrix = rows.map((tr) => Array.from(tr.children).filter((c) => /^(TD|TH)$/.test(c.nodeName)).map((c) => cellText(td, c)));
      const width = Math.max(...matrix.map((r) => r.length));
      const pad = (r) => [...r, ...Array(width - r.length).fill('')];
      const [head, ...body] = matrix;
      const lines = [`| ${pad(head).join(' | ')} |`, `| ${Array(width).fill('---').join(' | ')} |`, ...body.map((r) => `| ${pad(r).join(' | ')} |`)];
      return `\n\n${lines.join('\n')}\n\n`;
    },
  });
  turndownInstance = td;
  return td;
}

export function parseDocument(html) {
  const text = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head></head><body>${html}</body></html>`;
  return parseHTML(text).document;
}

/** Find <link rel="alternate" type="text/markdown" href> and return it as an absolute URL. */
export function findMarkdownAlternate(html, baseUrl) {
  const doc = parseDocument(html);
  for (const link of doc.querySelectorAll('link[rel="alternate"]')) {
    if ((link.getAttribute('type') || '').toLowerCase() === 'text/markdown' && link.getAttribute('href')) {
      try {
        return new URL(link.getAttribute('href'), baseUrl).href;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function decodeTitle(doc) {
  const h1 = doc.querySelector('h1');
  const t = doc.querySelector('title');
  const fromH1 = h1?.textContent?.trim();
  if (fromH1) return fromH1.replace(/\s+/g, ' ');
  const fromTitle = t?.textContent?.trim();
  return fromTitle ? fromTitle.split(/\s+[|–—-]\s+/)[0].trim() : null;
}

/**
 * Convert HTML to Markdown.
 * options: { url, engine: 'turndown' | 'defuddle', selector, strip: [{selector}|{heading}] }
 * Returns { title, markdown, note }.
 */
export async function htmlToMarkdown(html, options = {}) {
  const { url = 'https://example.invalid/', engine = 'defuddle', selector = null, strip = [] } = options;
  const doc = parseDocument(html);
  let note = null;
  const title = decodeTitle(doc);
  let root = doc.body || doc.documentElement;
  if (selector) {
    const found = doc.querySelector(selector);
    if (found) root = found;
    else note = `selector "${selector}" not found; used the whole page`;
  }
  for (const rule of strip) {
    if (rule && rule.selector) for (const n of [...root.querySelectorAll(rule.selector)]) n.remove();
  }
  for (const n of [...root.querySelectorAll('script, style, noscript, template')]) n.remove();

  let markdown;
  if (engine === 'turndown') {
    markdown = getTurndown().turndown(root.innerHTML || '');
  } else {
    const { Defuddle } = await import('defuddle/node');
    const page = `<!doctype html><html><head><title>${(title || '').replace(/</g, '&lt;')}</title></head><body>${root.outerHTML}</body></html>`;
    let result = null;
    try {
      const pageDoc = parseHTML(page).document;
      const origError = console.error;
      console.error = () => {};
      try {
        result = await Defuddle(pageDoc, url, { markdown: true });
      } finally {
        console.error = origError;
      }
    } catch (e) {
      note = `defuddle failed (${e.message}); used turndown`;
    }
    markdown = result?.content?.trim() ? result.content : getTurndown().turndown(root.innerHTML || '');
  }
  markdown = markdown.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  if (title && !/^#\s+/m.test(markdown)) markdown = `# ${title}\n\n${markdown}`;
  // Defuddle demotes the H1 to H2 when it matches the title; restore a single H1.
  else if (title && !/^#\s/m.test(markdown.split('\n')[0])) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^##\\s+${esc}\\s*$`, 'm');
    if (re.test(markdown)) markdown = markdown.replace(re, `# ${title}`);
  }
  for (const rule of strip) {
    if (rule && rule.heading) markdown = stripSection(markdown, rule.heading);
  }
  return { title, markdown, note };
}
