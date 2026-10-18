// MDX -> Markdown: drop imports/exports, JSX comments and component tags, keep text and code.
import { mapOutsideCode, splitFrontmatter } from './fences.mjs';

export function stripMdx(src) {
  const { fm, body } = splitFrontmatter(src);
  const out = mapOutsideCode(body, (text) => {
    let t = text;
    t = t.replace(/^(import|export)\s[\s\S]*?(;\s*$|\n(?=\s*\n))/gm, '');
    t = t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    // Self-closing components (may span lines).
    t = t.replace(/<[A-Z][\w.]*(?:\s[^<>]*?)?\/>/gs, '');
    // Opening/closing component tags: keep the inner text.
    t = t.replace(/<\/?[A-Z][\w.]*(?:\s[^<>]*?)?>/gs, '');
    return t;
  });
  return fm + out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+/, '');
}
