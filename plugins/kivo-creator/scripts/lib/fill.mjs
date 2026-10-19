// plugins/kivo-creator/scripts/lib/fill.mjs
/**
 * Compatibility filter: which block fields can hold which spec slots.
 * Field types use the ACF vocabulary; native adapters translate block.json
 * attributes into it.
 */
export const ACCEPTS = {
  heading: ['text', 'textarea', 'wysiwyg'],
  text: ['textarea', 'wysiwyg', 'text'],
  richtext: ['wysiwyg'],
  image: ['image'],
  link: ['link', 'url'],
  embed: ['oembed', 'url'],
  list: ['repeater'],
  form: [],
};
const CONTENT_TYPES = new Set(['text', 'textarea', 'wysiwyg', 'image', 'link', 'url', 'oembed', 'repeater']);
const SYNONYMS = {
  heading: ['title', 'heading', 'headline'],
  text: ['text', 'lead', 'body', 'description', 'content', 'subtitle', 'intro', 'answer'],
  image: ['image', 'media', 'photo', 'picture', 'icon'],
  link: ['cta', 'link', 'button', 'url'],
};

function nameScore(slot, field) {
  const words = SYNONYMS[slot.type] ?? [slot.name.replace(/_\d+$/, '')];
  const name = field.name.toLowerCase();
  if (words.includes(name)) return 2;
  return words.some((w) => name.includes(w)) ? 1 : 0;
}

function listFits(slot, field) {
  if (slot.type !== 'list') return true;
  const count = slot.items?.length ?? 0;
  if (field.max && count > field.max) return false;
  if (field.min && count < field.min) return false;
  if (!field.subFields?.length) return true;
  return (slot.items ?? []).every((item) => assign(item, field.subFields).leftovers.length === 0);
}

/** Greedy assignment: exact name, then partial name, then the first field of an accepted type. */
export function assign(slots, fields) {
  const free = fields.filter((f) => CONTENT_TYPES.has(f.type));
  const used = new Set();
  const pairs = [];
  const leftovers = [];
  for (const slot of slots) {
    const ok = (f) => !used.has(f.name) && (ACCEPTS[slot.type] ?? []).includes(f.type) && listFits(slot, f);
    const field = free.find((f) => ok(f) && nameScore(slot, f) === 2)
      ?? free.find((f) => ok(f) && nameScore(slot, f) === 1)
      ?? (ACCEPTS[slot.type] ?? []).map((t) => free.find((f) => f.type === t && ok(f))).find(Boolean);
    if (field) { used.add(field.name); pairs.push({ slot, field }); } else leftovers.push(slot);
  }
  return { pairs, leftovers, unused: free.filter((f) => !used.has(f.name)), coverage: free.length ? pairs.length / free.length : 0 };
}

/** Field value for a slot (ACF shapes; image values are resolved to attachments by the adapter). */
export function valueFor(slot, field) {
  switch (field.type) {
    case 'link': return { url: slot.value?.href ?? '', title: slot.value?.text ?? '', target: '' };
    case 'url': return slot.value?.href ?? slot.value?.src ?? String(slot.value ?? '');
    case 'oembed': return slot.value?.src ?? '';
    case 'image': return { src: slot.value?.src ?? null, alt: slot.value?.alt ?? '' };
    case 'repeater': return (slot.items ?? []).map((item) => Object.fromEntries(assign(item, field.subFields ?? []).pairs.map((p) => [p.field.name, valueFor(p.slot, p.field)])));
    default: return typeof slot.value === 'string' ? slot.value : slot.value?.text ?? '';
  }
}
