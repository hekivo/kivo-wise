// VitePress markdown cleanup (docs.lando.dev sources): containers to paragraphs, no Vue blocks.
import { mapOutsideCode, splitFrontmatter } from './fences.mjs';

const CONTAINER_LABELS = { tip: 'Tip', info: 'Info', warning: 'Warning', danger: 'Danger', details: 'Details', note: 'Note', caution: 'Caution' };

export function stripVitepress(src) {
  const { fm, body } = splitFrontmatter(src);
  let out = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>\s*/gi, '');
  out = mapOutsideCode(out, (text) =>
    text
      .split('\n')
      .flatMap((line) => {
        const open = /^\s*:::+\s*([\w-]+)?\s*(.*?)\s*$/.exec(line);
        if (open) {
          const kind = (open[1] || '').toLowerCase();
          if (!kind) return []; // closing fence
          if (kind === 'code-group' || kind === 'raw' || kind === 'v-pre') return [];
          const label = open[2] || CONTAINER_LABELS[kind] || kind.charAt(0).toUpperCase() + kind.slice(1);
          return [`**${label}**`, ''];
        }
        // Self-closing or wrapper Vue components on their own line.
        if (/^\s*<\/?[A-Z][\w-]*(\s[^>]*)?\/?>\s*$/.test(line)) return [];
        return [line];
      })
      .join('\n'),
  );
  return fm + out.replace(/\n{3,}/g, '\n\n').replace(/^\s+/, '');
}
