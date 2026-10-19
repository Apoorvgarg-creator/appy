import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readMobileOrigin, saveMobileOrigin, validateMobileOrigin } from './mobile-config.mjs';

test('mobile configuration accepts only exact canonical private HTTPS origins', () => {
  assert.equal(validateMobileOrigin('https://mac-mini.example.ts.net'), 'https://mac-mini.example.ts.net');
  assert.equal(validateMobileOrigin(''), '');
  for (const value of ['http://mac.example.ts.net', 'https://mac.example.ts.net/', 'https://mac.example.ts.net:443', 'https://mac.example.ts.net:8443', 'https://mac.example.ts.net?q=x', 'https://mac.example.ts.net#x', 'https://a:b@mac.example.ts.net', 'https://*.example.ts.net', 'https://mac.example.ts.net.', 'https://mac.example.ts.net.evil.com', 'https://MAC.example.ts.net', 'https://mac.ts.net', 'https://-mac.example.ts.net', 'https://127.0.0.1']) {
    assert.throws(() => validateMobileOrigin(value), /exact private HTTPS/);
  }
});

test('saved mobile settings are opt-in, replaceable, removable, and overridable', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'appy-mobile-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(await readMobileOrigin(root, {}), '');
  await saveMobileOrigin(root, 'https://mac.example.ts.net');
  assert.equal(await readMobileOrigin(root, {}), 'https://mac.example.ts.net');
  assert.equal(await readMobileOrigin(root, { APPY_MOBILE_ORIGIN: '' }), '');
  await saveMobileOrigin(root, 'https://mini.example.ts.net');
  assert.equal(await readMobileOrigin(root, {}), 'https://mini.example.ts.net');
  await saveMobileOrigin(root, 'off');
  assert.equal(await readMobileOrigin(root, {}), '');
  await symlink(path.join(root, 'unknown'), path.join(root, '.data/mobile-origin'));
  await assert.rejects(readMobileOrigin(root, {}), /Invalid .data/);
});
