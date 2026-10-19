import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, RequestError } from './api.ts';
import { pairBrowser } from './session.ts';

const connected = { mode: 'remote', authenticated: true, name: 'iPad', expires_at: '2026-10-14T20:00:00Z' };
const unpaired = { mode: 'remote', authenticated: false, name: null, expires_at: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('a lost pairing response checks the cookie session exactly once and never repeats the POST', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  const client = createClient(async (path, init) => {
    calls.push({ path: String(path), init: init! });
    if (calls.length === 1) throw new TypeError('Response lost after cookie reached browser');
    return json(connected);
  });
  assert.deepEqual(await pairBrowser(client.request, { code: '12345678', name: 'iPad' }), connected);
  assert.deepEqual(calls.map((call) => call.init.method), ['POST', 'GET']);
  assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/json' }, 'ephemeral pairing sends no idempotency key');
  assert.ok(calls.every((call) => call.init.credentials === 'same-origin' && call.init.cache === 'no-store'));
});

test('an unconfirmed pairing never resubmits or creates a workspace session', async () => {
  let posts = 0;
  let gets = 0;
  const client = createClient(async (_path, init) => {
    if (init?.method === 'POST') { posts += 1; throw new TypeError('Offline'); }
    gets += 1;
    return json(unpaired);
  });
  await assert.rejects(pairBrowser(client.request, { code: '12345678', name: 'iPad' }), (error) => error instanceof RequestError && error.uncertain && error.message.includes('check your access'));
  assert.equal(posts, 1);
  assert.equal(gets, 1);
});

test('an incorrect pairing code is definite and does not expire a workspace or poll status', async () => {
  let requests = 0;
  let expired = 0;
  const client = createClient(async () => { requests += 1; return json({ error: { code: 'invalid_code', message: 'Check the code' } }, 401); }, () => 'test_key', () => { expired += 1; });
  await assert.rejects(pairBrowser(client.request, { code: '00000000', name: 'iPad' }), (error) => error instanceof RequestError && error.status === 401 && !error.uncertain);
  assert.equal(requests, 1);
  assert.equal(expired, 0);
});

test('a protected unauthorized response expires the workspace even if its error body is unreadable', async () => {
  let expired = 0;
  const client = createClient(async () => new Response('not JSON', { status: 401 }), () => 'test_key', () => { expired += 1; });
  await assert.rejects(client.request('/api/v1/workspace'));
  assert.equal(expired, 1);
});

test('discarding a browser session removes pending action keys and ignores late unauthorized responses', async () => {
  const keys: unknown[] = [];
  let nextKey = 0;
  let expired = 0;
  let release: (value: Response) => void = () => {};
  const client = createClient(async (path, init) => {
    if (String(path).endsWith('/workspace')) return new Promise<Response>((resolve) => { release = resolve; });
    keys.push(init?.headers);
    throw new TypeError('Lost action response');
  }, () => `request_${++nextKey}`, () => { expired += 1; });
  const oldStatus = client.request('/api/v1/workspace');
  await assert.rejects(client.request('/api/v1/control', { action: 'stop_all' }));
  client.clearPending();
  await assert.rejects(client.request('/api/v1/control', { action: 'stop_all' }));
  assert.notDeepEqual(keys[0], keys[1]);
  release(json({ error: { code: 'unauthorized', message: 'Expired' } }, 401));
  await assert.rejects(oldStatus);
  assert.equal(expired, 0, 'an old browser session cannot invalidate a newly paired one');
});

test('a late confirmed action cannot clear a new browser session’s uncertain operation key', async () => {
  let nextKey = 0;
  let release: (value: Response) => void = () => {};
  const headers: unknown[] = [];
  const client = createClient(async (_path, init) => {
    headers.push(init?.headers);
    if (headers.length === 1) return new Promise<Response>((resolve) => { release = resolve; });
    throw new TypeError('Response lost');
  }, () => `request_${++nextKey}`);
  const action = { action: 'stop_all' };
  const oldAction = client.request('/api/v1/control', action);
  client.clearPending();
  await assert.rejects(client.request('/api/v1/control', action));
  release(json({ admission: 'stopped' }));
  await oldAction;
  await assert.rejects(client.request('/api/v1/control', action));
  assert.deepEqual(headers[1], headers[2]);
});
