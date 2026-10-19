// plugins/kivo-creator/scripts/lib/block-markup.mjs
/**
 * Mirrors serialize_block_attributes() in wp-includes/blocks.php: JSON with
 * unescaped slashes and unicode, then \\, --, <, >, & and \" replaced by \u
 * sequences in one left-to-right pass (strtr semantics).
 */
const ESCAPES = { '\\\\': '\\u005c', '--': '\\u002d\\u002d', '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\\"': '\\u0022' };

export function serializeAttributes(attrs) {
  return JSON.stringify(attrs).replace(/\\\\|--|<|>|&|\\"/g, (m) => ESCAPES[m]);
}

export function serializeBlock(name, attrs = {}, inner = '') {
  const short = name.startsWith('core/') ? name.slice(5) : name;
  const json = Object.keys(attrs).length ? ` ${serializeAttributes(attrs)}` : '';
  return inner ? `<!-- wp:${short}${json} -->\n${inner}\n<!-- /wp:${short} -->` : `<!-- wp:${short}${json} /-->`;
}
