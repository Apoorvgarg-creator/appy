// Inert render-only evidence; this does not exercise cookies, HTTPS or interactions.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { PairingScreen } from '../web/src/SessionGate';
import { MobileAccess } from '../web/src/MobileAccess';
import type { MobileAccess as AccessState } from '../web/src/generated/api';

const root = process.cwd();
const output = resolve(root, 'artifacts/local/mobile-review');
mkdirSync(output, { recursive: true });
const samples = JSON.parse(execFileSync('go', ['run', './cmd/contractcheck', '-mobile'], {
  encoding: 'utf8', env: { ...process.env, GOCACHE: resolve(root, '.cache/go'), GOTOOLCHAIN: 'local' },
})) as { path: string; status: number; body: AccessState }[];
const invite = samples.find(sample => sample.path === '/api/v1/access/invite' && sample.status === 200)!.body;
const connected = samples.find(sample => sample.path === '/api/v1/access' && sample.status === 200)!.body;
const css = readdirSync(resolve(root, 'web/dist/assets')).filter(name => name.endsWith('.css')).map(name => readFileSync(resolve(root, 'web/dist/assets', name), 'utf8')).join('\n').replaceAll('/fonts/', './fonts/');
writeFileSync(resolve(output, 'styles.css'), css);
cpSync(resolve(root, 'web/public/fonts'), resolve(output, 'fonts'), { recursive: true });
const cases = [
  ['pair', <PairingScreen connect={async () => {}} checkAccess={() => {}} />],
  ['pair-error', <PairingScreen message="This browser’s access expired or was disconnected. Get a new code on your Mac to reconnect." connect={async () => {}} checkAccess={() => {}} />],
  ['invite', <main className="content-shell"><MobileAccess initialAccess={invite} /></main>],
  ['connected', <main className="content-shell"><MobileAccess initialAccess={connected} /></main>],
] as const;
for (const [name, component] of cases) {
  writeFileSync(resolve(output, `${name}.html`), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Appy ${name} — static review</title><link rel="stylesheet" href="styles.css"></head><body>${renderToStaticMarkup(component)}</body></html>`);
}
writeFileSync(resolve(output, 'README.txt'), 'Render-only review; no interactive controls or live mobile connection. Access samples come from the real Go gateway/fixture handler; its temporary sessions are destroyed at process exit.\n');
console.log(`Rendered ${cases.length} static mobile review pages in ${output}`);
