import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contract, resolve } from './schema.mjs';

function type(schema) {
  if (schema.$ref) { resolve(schema.$ref); return schema.$ref.split('/').at(-1); }
  if (schema.anyOf) return schema.anyOf.map(type).join(' | ');
  if (schema.enum) return schema.enum.map(value => JSON.stringify(value)).join(' | ');
  if (schema.type === 'array') return `Array<${type(schema.items)}>`;
  if (schema.type === 'object') {
    return `{\n${Object.entries(schema.properties).map(([key, value]) => `  ${JSON.stringify(key)}${schema.required?.includes(key) ? '' : '?'}: ${type(value)};`).join('\n')}\n}`;
  }
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (['string', 'boolean', 'null'].includes(schema.type)) return schema.type;
  throw new Error(`Unsupported type: ${schema.type}`);
}

const source = '// Generated from contracts/openapi.json by npm run generate. Do not edit.\n\n'
  + Object.entries(contract.components.schemas).map(([name, schema]) => `export type ${name} = ${type(schema)};\n`).join('\n');
const target = new URL('../web/src/generated/api.ts', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== source) throw new Error('API types are stale. Run npm run generate.');
  console.log('Generated API types match the contract.');
} else {
  mkdirSync(fileURLToPath(new URL('.', target)), { recursive: true });
  writeFileSync(target, source);
  console.log('Generated web/src/generated/api.ts');
}
