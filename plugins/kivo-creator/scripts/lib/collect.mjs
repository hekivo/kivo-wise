// plugins/kivo-creator/scripts/lib/collect.mjs
/**
 * Runs INSIDE the page (page.evaluate). Must stay self-contained: no imports,
 * no closures over module scope. Returns the snapshot shape used by segment.mjs.
 */
export function collectSnapshot({ selector = null, index = 0, maxDepth = 12 } = {}) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META']);
  const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'textAlign', 'paddingTop', 'paddingBottom', 'display'];
  const ATTRS = ['href', 'src', 'alt', 'type', 'name', 'action', 'id', 'placeholder', 'data-block'];
  const cssPath = (el) => {
    const parts = [];
    while (el && el.nodeType === 1 && el.tagName !== 'HTML') {
      const tag = el.tagName.toLowerCase();
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) { parts.unshift(`${tag}#${el.id}`); break; }
      let i = 1;
      let sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) i++;
      parts.unshift(`${tag}:nth-of-type(${i})`);
      el = el.parentElement;
    }
    return parts.join(' > ');
  };
  const visit = (el, depth) => {
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const style = {};
    for (const p of PROPS) style[p] = cs[p];
    const attrs = {};
    for (const a of ATTRS) {
      const raw = el.getAttribute(a);
      if (raw === null) continue;
      attrs[a] = (a === 'href' || a === 'src') && typeof el[a] === 'string' && el[a] ? el[a] : raw;
    }
    const text = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    const node = {
      tag: el.tagName.toLowerCase(),
      path: cssPath(el),
      role: el.getAttribute('role') || undefined,
      cls: Array.from(el.classList).slice(0, 6),
      rect: { x: Math.round(box.left + scrollX), y: Math.round(box.top + scrollY), w: Math.round(box.width), h: Math.round(box.height) },
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && box.width > 0 && box.height > 0,
      text,
      attrs,
      style,
      children: [],
    };
    if (depth < maxDepth) for (const child of el.children) if (!SKIP.has(child.tagName)) node.children.push(visit(child, depth + 1));
    return node;
  };
  const root = selector ? document.querySelectorAll(selector)[index] : document.body;
  return root ? visit(root, 0) : null;
}
