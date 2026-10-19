import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, RequestError } from './api.ts';

test('a lost mutation response retains its key and exact request on explicit retry', async () => {
  const calls: RequestInit[] = [];
  let keys = 0;
  const client = createClient(async (_input, init) => {
    calls.push(init!);
    if (calls.length === 1) throw new TypeError('Connection lost after commit');
    return new Response(JSON.stringify({ id: 'task_1' }), { status: 201 });
  }, () => `key_${++keys}`);
  const body = { goal: 'Summarize the sample', recipe: 'repository_summary' };
  await assert.rejects(client.request('/api/v1/tasks', body), (error) => error instanceof RequestError && error.uncertain);
  assert.deepEqual(await client.request('/api/v1/tasks', body), { id: 'task_1' });
  assert.deepEqual(calls[0].headers, calls[1].headers);
  assert.equal(calls[0].body, calls[1].body);
  await client.request('/api/v1/tasks', body);
  assert.notDeepEqual(calls[1].headers, calls[2].headers, 'a confirmed next operation gets a new key');
});

test('a stale revision is definite, while a server failure retains the operation key', async () => {
  const calls: RequestInit[] = [];
  const statuses = [409, 503, 200];
  let keys = 0;
  const client = createClient(async (_input, init) => {
    calls.push(init!);
    return new Response(JSON.stringify({ error: { code: 'stale', message: 'Refresh the task' } }), { status: statuses.shift() });
  }, () => `key_${++keys}`);
  const body = { action: 'start', expected_revision: 1 };
  await assert.rejects(client.request('/api/v1/tasks/task_1/actions', body), (error) => error instanceof RequestError && error.status === 409 && !error.uncertain);
  await assert.rejects(client.request('/api/v1/tasks/task_1/actions', body), (error) => error instanceof RequestError && error.uncertain);
  await client.request('/api/v1/tasks/task_1/actions', body);
  assert.notDeepEqual(calls[0].headers, calls[1].headers);
  assert.deepEqual(calls[1].headers, calls[2].headers);
});
