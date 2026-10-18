// Helpers to transform markdown outside fenced code blocks only.

/** Split markdown into segments: { code: boolean, text }. */
export function splitFences(src) {
  const lines = src.split('\n');
  const segments = [];
  let buf = [];
  let inCode = false;
  let fence = '';
  const flush = (code) => {
    if (buf.length) segments.push({ code, text: buf.join('\n') });
    buf = [];
  };
  for (const line of lines) {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (!inCode && m) {
      flush(false);
      inCode = true;
      fence = m[1];
      buf.push(line);
    } else if (inCode && m && m[1][0] === fence[0] && m[1].length >= fence.length && /^\s*(```+|~~~+)\s*$/.test(line)) {
      buf.push(line);
      flush(true);
      inCode = false;
    } else {
      buf.push(line);
    }
  }
  flush(inCode);
  return segments;
}

export function mapOutsideCode(src, fn) {
  return splitFences(src)
    .map((s) => (s.code ? s.text : fn(s.text)))
    .join('\n');
}

export function splitFrontmatter(src) {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(src);
  return m ? { fm: m[0], body: src.slice(m[0].length) } : { fm: '', body: src };
}
