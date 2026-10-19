// plugins/kivo-creator/scripts/lib/schema.mjs
/**
 * Minimal JSON Schema checker for the schemas this plugin ships: type, enum,
 * const, required, properties, additionalProperties (false or schema), items,
 * minItems, minLength, pattern, minimum, maximum and $ref into #/$defs.
 * Returns a list of "<path>: <problem>" strings; empty means valid.
 */
export function validate(schema, value, root = schema, path = '$', errors = []) {
  if (schema.$ref) {
    const def = root.$defs?.[schema.$ref.replace(/^#\/\$defs\//, '')];
    if (!def) errors.push(`${path}: unknown $ref ${schema.$ref}`);
    else validate(def, value, root, path, errors);
    return errors;
  }
  if ('const' in schema && value !== schema.const) errors.push(`${path}: expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in [${schema.enum.join(', ')}]`);
    return errors;
  }
  if (schema.type) {
    const actual = typeOf(value);
    const types = [].concat(schema.type);
    if (!types.some((t) => t === actual || (t === 'number' && actual === 'integer'))) {
      errors.push(`${path}: expected ${types.join('|')}, got ${actual}`);
      return errors;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((item, i) => validate(schema.items, item, root, `${path}[${i}]`, errors));
  } else if (value && typeof value === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key}: missing`);
    for (const [key, child] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) validate(sub, child, root, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
      else if (typeof schema.additionalProperties === 'object') validate(schema.additionalProperties, child, root, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}
