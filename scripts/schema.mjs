import { readFileSync } from 'node:fs';

export const contract = JSON.parse(readFileSync(new URL('../contracts/openapi.json', import.meta.url), 'utf8'));

export function resolve(ref) {
  const prefix = '#/components/schemas/';
  if (!ref.startsWith(prefix) || !/^[A-Za-z][A-Za-z0-9]*$/.test(ref.slice(prefix.length))) {
    throw new Error(`Only local named schema references are supported: ${ref}`);
  }
  const schema = contract.components.schemas[ref.slice(prefix.length)];
  if (!schema) throw new Error(`Unknown schema: ${ref}`);
  return schema;
}

// Validate the JSON Schema subset used by this contract. Unsupported assertions
// fail rather than silently weakening future contract checks.
const supported = new Set(['$ref', 'type', 'additionalProperties', 'required', 'properties', 'items', 'enum', 'anyOf', 'format', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'description']);
export function validate(schema, value, path = '$') {
  for (const key of Object.keys(schema)) {
    if (!supported.has(key)) throw new Error(`Unsupported schema keyword: ${key}`);
  }
  if (schema.$ref) return validate(resolve(schema.$ref), value, path);
  if (schema.anyOf) {
    const branches = schema.anyOf.map(branch => validate(branch, value, path));
    return branches.some(errors => !errors.length) ? [] : [`${path}: no anyOf branch matches`];
  }
  const errors = [];
  const fail = reason => errors.push(`${path}: ${reason}`);
  const type = schema.type;
  const matches = type === 'null' ? value === null
    : type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value)
    : type === 'integer' ? Number.isSafeInteger(value)
    : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
    : typeof value === type;
  if (!matches) return [`${path}: expected ${type}`];
  if (schema.enum && !schema.enum.includes(value)) fail('value is outside enum');
  if (type === 'object') {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...validate(schema.properties[key], item, `${path}.${key}`));
      else if (schema.additionalProperties === false) fail(`unknown property ${key}`);
    }
  }
  if (type === 'array') value.forEach((item, index) => errors.push(...validate(schema.items, item, `${path}[${index}]`)));
  if (type === 'string') {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) fail('too short');
    if (schema.maxLength !== undefined && length > schema.maxLength) fail('too long');
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) fail('pattern mismatch');
    if (schema.format && schema.format !== 'date-time') throw new Error(`Unsupported format: ${schema.format}`);
    if (schema.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) fail('invalid timestamp');
  }
  if (type === 'integer' || type === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) fail('below minimum');
    if (schema.maximum !== undefined && value > schema.maximum) fail('above maximum');
  }
  return errors;
}
