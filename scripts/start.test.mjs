import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startAppy, validateBuild } from './start.mjs';

const options = { root: '/tmp/Appy project with spaces', readyTimeout: 1000, pollInterval: 1, stopTimeout: 5 };
const marker = 'Appy listening at http://127.0.0.1:8787\n';

function runtime(config = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const signals = new EventEmitter();
  const record = { output: '', errors: '', opens: [], kills: [], probes: 0, spawn: null };
  child.kill = signal => {
    record.kills.push(signal);
    if (!config.ignoreTerm || signal === 'SIGKILL') queueMicrotask(() => child.emit('exit', null, signal));
    return true;
  };
  const dependencies = {
    signals,
    validateBuild: async root => assert.equal(root, options.root),
    readMobileOrigin: async () => '',
    stdout: text => { record.output += text; },
    stderr: text => { record.errors += text; },
    spawn: (...args) => {
      record.spawn = args;
      queueMicrotask(() => {
        if (config.onSpawn) config.onSpawn(child);
        else { child.stdout.write(marker.slice(0, 12)); child.stdout.write(marker.slice(12)); }
      });
      return child;
    },
    probeReady: async () => {
      record.probes++;
      return config.probe ? config.probe(child, record) : true;
    },
    openBrowser: async url => {
      record.opens.push(url);
      if (config.open) return config.open(child, signals, record);
      queueMicrotask(() => child.emit('exit', 0, null));
      return true;
    },
  };
  return { child, signals, record, dependencies };
}

test('build validation rejects missing binaries and referenced assets with rebuild guidance', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'appy start with spaces '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(validateBuild(root), /npm ci --ignore-scripts[\s\S]*make build/);
  await mkdir(path.join(root, 'bin'));
  await writeFile(path.join(root, 'bin/appy'), '#!/bin/sh\n');
  await chmod(path.join(root, 'bin/appy'), 0o755);
  await mkdir(path.join(root, 'web/dist/assets'), { recursive: true });
  await writeFile(path.join(root, 'web/dist/index.html'), '<script src="/assets/app.js"></script><link href="/assets/app.css">');
  await writeFile(path.join(root, 'web/dist/assets/app.js'), '');
  await assert.rejects(validateBuild(root), /missing or incomplete/);
  await writeFile(path.join(root, 'web/dist/assets/app.css'), '');
  await validateBuild(root);
  await chmod(path.join(root, 'bin/appy'), 0o644);
  await assert.rejects(validateBuild(root), /missing or incomplete/);
});

test('launcher roots paths independently of cwd and waits for its own marker and HTTP readiness', async () => {
  const fake = runtime({ probe: (_child, record) => record.probes >= 2 });
  assert.equal(await startAppy(options, fake.dependencies), 0);
  assert.deepEqual(fake.record.spawn, [
    `${options.root}/bin/appy`, ['-addr', '127.0.0.1:8787', '-data-dir', `${options.root}/.data/appy`, '-web-dir', `${options.root}/web/dist`],
    { cwd: options.root, stdio: ['inherit', 'pipe', 'pipe'] },
  ]);
  assert.equal(fake.record.probes, 2);
  assert.deepEqual(fake.record.opens, ['http://127.0.0.1:8787']);
  assert.match(fake.record.output, /Appy listening at http/);
  assert.deepEqual(fake.record.kills, []);
  assert.equal(fake.signals.listenerCount('SIGINT'), 0);
});

test('missing build never spawns a server or opens the browser', async () => {
  const fake = runtime();
  fake.dependencies.validateBuild = async () => { throw new Error('Build first'); };
  await assert.rejects(startAppy(options, fake.dependencies), /Build first/);
  assert.equal(fake.record.spawn, null);
  assert.deepEqual(fake.record.opens, []);
});

test('mobile configuration reaches only the explicitly opted-in server launch', async () => {
  const fake = runtime();
  fake.dependencies.readMobileOrigin = async () => 'https://mac.example.ts.net';
  assert.equal(await startAppy(options, fake.dependencies), 0);
  assert.deepEqual(fake.record.spawn[1].slice(-2), ['-mobile-origin', 'https://mac.example.ts.net']);
  const invalid = runtime();
  invalid.dependencies.readMobileOrigin = async () => { throw new Error('Invalid private address'); };
  await assert.rejects(startAppy(options, invalid.dependencies), /Invalid private address/);
  assert.equal(invalid.record.spawn, null);
});

test('bind errors and spawn failures remain visible and never open another listener', async () => {
  const failed = runtime({ onSpawn: child => {
    child.stderr.write('bind: address already in use\n');
    child.emit('exit', 1, null);
  } });
  await assert.rejects(startAppy(options, failed.dependencies), /exited before it was ready/);
  assert.match(failed.record.errors, /address already in use/);
  assert.deepEqual(failed.record.opens, []);
  assert.deepEqual(failed.record.kills, []);
  const spawnFailure = runtime({ onSpawn: child => child.emit('error', new Error('exec format error')) });
  await assert.rejects(startAppy(options, spawnFailure.dependencies), /exec format error/);
  assert.deepEqual(spawnFailure.record.opens, []);
});

test('HTTP success without this child’s marker times out and cleans up only its child', async () => {
  const fake = runtime({ onSpawn: () => {}, ignoreTerm: true });
  await assert.rejects(startAppy({ ...options, readyTimeout: 10 }, fake.dependencies), /did not become ready/);
  assert.equal(fake.record.probes, 0);
  assert.deepEqual(fake.record.opens, []);
  assert.deepEqual(fake.record.kills, ['SIGTERM', 'SIGKILL']);
});

test('a child that exits during an HTTP readiness check cannot open the browser', async () => {
  const fake = runtime({ probe: child => { child.emit('exit', 1, null); return true; } });
  await assert.rejects(startAppy(options, fake.dependencies), /exited before it was ready/);
  assert.deepEqual(fake.record.opens, []);
});

test('interrupting startup stops its child and removes signal handlers', async () => {
  const fake = runtime({ probe: () => { fake.signals.emit('SIGINT'); return false; } });
  assert.equal(await startAppy(options, fake.dependencies), 130);
  assert.deepEqual(fake.record.kills, ['SIGTERM']);
  assert.deepEqual(fake.record.opens, []);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) assert.equal(fake.signals.listenerCount(signal), 0);
});

test('browser-open failure preserves the running server and prints its usable URL', async () => {
  const fake = runtime({ open: (_child, signals, record) => {
    setImmediate(() => {
      assert.deepEqual(record.kills, [], 'browser failure must not terminate the server');
      assert.match(record.errors, /http:\/\/127\.0\.0\.1:8787 manually\. Appy is still running/);
      signals.emit('SIGTERM');
    });
    throw new Error('No browser available');
  } });
  assert.equal(await startAppy(options, fake.dependencies), 143);
  assert.deepEqual(fake.record.kills, ['SIGTERM']);
});
