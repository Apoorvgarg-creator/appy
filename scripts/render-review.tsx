// Render-only QA artifacts from actual in-process Go handler responses.
// These pages contain no JavaScript and are not interactive or a server fallback.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../web/src/App';
import type { Workspace, Task } from '../web/src/generated/api';

const root = process.cwd();
const output = resolve(root, 'artifacts/local/foundation-review');
mkdirSync(output, { recursive: true });
const samples = JSON.parse(execFileSync('go', ['run', './cmd/contractcheck'], {
  encoding: 'utf8', env: { ...process.env, GOCACHE: resolve(root, '.cache/go'), GOTOOLCHAIN: 'local' },
})) as { path: string; status: number; body: Workspace | Task }[];
const empty = samples.find(sample => sample.path === '/api/v1/workspace' && sample.status === 200)!.body as Workspace;
const complete = [...samples].reverse().find(sample => sample.path === '/api/v1/workspace' && sample.status === 200)!.body as Workspace;
const running = samples.find(sample => 'status' in sample.body && sample.body.status === 'running')!.body as Task;
const waiting = samples.find(sample => 'status' in sample.body && sample.body.status === 'waiting_approval')!.body as Task;
const draft = samples.find(sample => 'status' in sample.body && sample.body.status === 'draft')!.body as Task;
const css = readdirSync(resolve(root, 'web/dist/assets')).filter(name => name.endsWith('.css')).map(name => readFileSync(resolve(root, 'web/dist/assets', name), 'utf8')).join('\n').replaceAll('/fonts/', './fonts/');
writeFileSync(resolve(output, 'styles.css'), css);
cpSync(resolve(root, 'web/public/fonts'), resolve(output, 'fonts'), { recursive: true });
const cases: [string, Workspace, {page: 'home' | 'task' | 'runner' | 'activity'; id?: string}][] = [
  ['home', empty, { page: 'home' }],
  ['draft', { ...empty, tasks: [draft] }, { page: 'task', id: draft.id }],
  ['running', { ...empty, tasks: [running] }, { page: 'task', id: running.id }],
  ['review', { ...empty, tasks: [waiting] }, { page: 'task', id: waiting.id }],
  ['result', complete, { page: 'task', id: complete.tasks[0].id }],
  ['runner', empty, { page: 'runner' }],
  ['activity', complete, { page: 'activity' }],
];
for (const [name, workspace, route] of cases) {
  const markup = renderToStaticMarkup(<App initialWorkspace={workspace} initialRoute={route} />);
  writeFileSync(resolve(output, `${name}.html`), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Appy ${name} — static review</title><link rel="stylesheet" href="styles.css"></head><body>${markup}</body></html>`);
}
writeFileSync(resolve(output, 'README.txt'), 'Static rendered review pages; controls do not work. Data came from the actual Go handler through httptest. This is visual evidence only, not a live end-to-end test.\n');
console.log(`Rendered ${cases.length} static review pages in ${output}`);
