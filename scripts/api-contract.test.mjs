import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { contract, validate } from './schema.mjs';

for (const mobile of [false, true]) test(`real Go handler responses conform through ${mobile ? 'mobile pairing, task approval and revocation' : 'local task approval'}`, { timeout: 120_000 }, () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cache = fileURLToPath(new URL('../.cache/go', import.meta.url));
  mkdirSync(cache, { recursive: true });
  const samples = JSON.parse(execFileSync('go', ['run', './cmd/contractcheck', ...(mobile ? ['-mobile'] : [])], {
    cwd: root, encoding: 'utf8', timeout: 110_000,
    env: { ...process.env, GOCACHE: cache, GOTOOLCHAIN: 'local' },
  }));
  assert.ok(samples.length >= 10, 'expected empty, running, approval, success and error responses');
  if (mobile) {
    assert.ok(samples.some(sample => sample.path === '/api/v1/session' && sample.body.authenticated && sample.body.mode === 'remote'));
    assert.ok(samples.some(sample => sample.path.endsWith('/artifact') && sample.status === 401), 'revocation must deny artifact access');
  }
  for (const sample of samples) {
    const path = sample.path.replace(/(\/tasks\/)[a-zA-Z0-9_-]+/, '$1{id}');
    const schema = contract.paths[path]?.[sample.method.toLowerCase()]?.responses[sample.status]?.content?.['application/json']?.schema;
    assert.ok(schema, `undocumented response: ${sample.method} ${path} ${sample.status}`);
    assert.deepEqual(validate(schema, sample.body), [], `${sample.method} ${path} ${sample.status}`);
  }
});
