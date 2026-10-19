import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contract, validate, resolve } from './schema.mjs';

test('contract rejects unknown fields, wrong variants and invalid boundaries', () => {
  const request = contract.components.schemas.CreateTask;
  assert.deepEqual(validate(request, { goal: 'Summarize the example', recipe: 'repository_summary' }), []);
  for (const bad of [
    { goal: '', recipe: 'repository_summary' },
    { goal: 'x'.repeat(301), recipe: 'repository_summary' },
    { goal: 'Read files', recipe: 'shell' },
    { goal: 'Read files', recipe: 'repository_summary', path: '/etc' },
    { goal: 42, recipe: 'repository_summary' },
  ]) assert.ok(validate(request, bad).length);
});

test('references and unknown schema assertions fail closed', () => {
  assert.throws(() => resolve('https://example.test/schema'));
  assert.throws(() => resolve('#/components/schemas/../../secrets'));
  assert.throws(() => validate({ type: 'string', unsupported: true }, 'example'));
  assert.ok(validate({ type: 'string', format: 'date-time' }, 'yesterday').length);
  assert.ok(validate({ type: 'integer', minimum: 1 }, 1.2).length);
  assert.deepEqual(validate({ anyOf: [{ type: 'null' }, { type: 'string' }] }, null), []);
});
