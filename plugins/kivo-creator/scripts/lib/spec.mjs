// plugins/kivo-creator/scripts/lib/spec.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas', 'section-spec.schema.json');
let schema;
export const specSchema = () => (schema ??= JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')));

/** Schema errors, or (when the shape is valid) semantic errors. Empty = valid. */
export function checkSpec(spec) {
  const errors = validate(specSchema(), spec);
  if (errors.length) return errors;
  const seen = new Set();
  spec.slots.forEach((slot, i) => {
    if (seen.has(slot.name)) errors.push(`$.slots[${i}]: duplicate slot name "${slot.name}"`);
    seen.add(slot.name);
  });
  checkSlots(spec.slots, '$.slots', errors);
  for (const key of Object.keys(spec.refs)) if (!/^\d+$/.test(key)) errors.push(`$.refs.${key}: key must be a width in px`);
  return errors;
}

function checkSlots(slots, path, errors) {
  slots.forEach((slot, i) => {
    const at = `${path}[${i}]`;
    if (slot.type === 'list') {
      if (!Array.isArray(slot.items) || slot.items.length === 0) errors.push(`${at}: list slot "${slot.name}" needs at least one item`);
      else slot.items.forEach((item, j) => checkSlots(item, `${at}.items[${j}]`, errors));
      return;
    }
    if (slot.value === undefined || slot.value === null || slot.value === '') {
      errors.push(`${at}: slot "${slot.name}" has no value`);
      return;
    }
    if (slot.type === 'image' && !slot.value?.src) errors.push(`${at}: image slot "${slot.name}" needs value.src`);
    if (slot.type === 'link' && typeof slot.value?.href !== 'string') errors.push(`${at}: link slot "${slot.name}" needs value.href`);
  });
}

export function readSpecs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
