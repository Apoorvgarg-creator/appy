import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, lstat, readFile } from 'node:fs/promises';
import { get } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMobileOrigin } from './mobile-config.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const address = '127.0.0.1:8787';
const url = `http://${address}`;
const buildHelp = 'From the Appy folder, run:\n  npm ci --ignore-scripts\n  make build\nThen run npm start again.';

export async function validateBuild(root) {
  try {
    await access(path.join(root, 'bin/appy'), constants.X_OK);
    const dist = path.join(root, 'web/dist');
    const html = await readFile(path.join(dist, 'index.html'), 'utf8');
    const assets = [...html.matchAll(/\b(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match => match[1]);
    if (!assets.some(asset => asset.endsWith('.js')) || !assets.some(asset => asset.endsWith('.css'))) {
      throw new Error('Frontend index has no JavaScript or stylesheet build references.');
    }
    for (const asset of assets) {
      const file = path.resolve(dist, `.${asset}`);
      if (!file.startsWith(`${dist}${path.sep}`) || !(await lstat(file)).isFile()) {
        throw new Error('Frontend asset is missing or is not a regular file.');
      }
    }
  } catch (error) {
    throw new Error(`Appy’s local build is missing or incomplete.\n${buildHelp}\nDetails: ${error.message}`);
  }
}

function checkResponse(target, contentType) {
  return new Promise(resolve => {
    const request = get(target, { agent: false, timeout: 1000 }, response => {
      resolve(response.statusCode === 200 && (response.headers['content-type'] ?? '').startsWith(contentType));
      response.destroy();
    });
    request.on('timeout', () => { resolve(false); request.destroy(); });
    request.on('error', () => resolve(false));
  });
}

async function probeReady() {
  const checks = await Promise.all([
    checkResponse(`${url}/`, 'text/html'),
    checkResponse(`${url}/api/v1/workspace`, 'application/json'),
  ]);
  return checks.every(Boolean);
}

function openBrowser(target) {
  if (process.platform !== 'darwin' && process.platform !== 'linux') return Promise.resolve(false);
  return new Promise(resolve => {
    const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill('SIGTERM'); resolve(false); }, 5000);
    const finish = success => { clearTimeout(timer); resolve(success); };
    child.once('error', () => finish(false));
    child.once('exit', code => finish(code === 0));
  });
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Dependencies are injectable so startup and cleanup can be checked without listening sockets. */
export async function startAppy(options = {}, dependencies = {}) {
  const root = path.resolve(options.root ?? repositoryRoot);
  const { readyTimeout = 15000, pollInterval = 100, stopTimeout = 5000 } = options;
  const deps = {
    validateBuild, readMobileOrigin, spawn, probeReady, openBrowser, signals: process,
    stdout: text => process.stdout.write(text), stderr: text => process.stderr.write(text),
    ...dependencies,
  };
  await deps.validateBuild(root);
  const mobileOrigin = await deps.readMobileOrigin(root);
  deps.stdout('Starting Appy on this computer…\nKeep this window open. Press Control-C to stop.\n');
  const child = deps.spawn(path.join(root, 'bin/appy'), [
    '-addr', address, '-data-dir', path.join(root, '.data/appy'), '-web-dir', path.join(root, 'web/dist'),
    ...(mobileOrigin ? ['-mobile-origin', mobileOrigin] : []),
  ], { cwd: root, stdio: ['inherit', 'pipe', 'pipe'] });
  let exited = false;
  let exitCode = null;
  let exitSignal = null;
  let spawnError = null;
  let listening = false;
  let output = '';
  let interrupted = null;
  let resolveFinished;
  let resolveInterrupted;
  let stopping;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const interruption = new Promise(resolve => { resolveInterrupted = resolve; });
  child.once('error', error => { spawnError = error; exited = true; resolveFinished(); });
  child.once('exit', (code, signal) => { exitCode = code; exitSignal = signal; exited = true; resolveFinished(); });
  child.stdout.on('data', chunk => {
    deps.stdout(chunk.toString());
    output += chunk.toString();
    let newline;
    while ((newline = output.indexOf('\n')) !== -1) {
      const line = output.slice(0, newline).trimEnd();
      output = output.slice(newline + 1);
      if (line === `Appy listening at ${url}`) listening = true;
    }
    // Startup output is a line protocol, not an unbounded log buffer.
    if (output.length > 8192) output = '';
  });
  child.stderr.on('data', chunk => deps.stderr(chunk.toString()));
  function waitForExit() {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, stopTimeout);
      finished.then(() => { clearTimeout(timer); resolve(); });
    });
  }
  function stopChild() {
    stopping ??= (async () => {
      if (exited) return;
      child.kill('SIGTERM');
      await waitForExit();
      if (!exited) {
        child.kill('SIGKILL');
        await waitForExit();
      }
    })();
    return stopping;
  }
  function interrupt(signal) {
    interrupted ??= signal;
    resolveInterrupted();
    void stopChild();
  }
  const onInterrupt = () => interrupt('SIGINT');
  const onTerminate = () => interrupt('SIGTERM');
  const onHangup = () => interrupt('SIGHUP');
  deps.signals.on('SIGINT', onInterrupt);
  deps.signals.on('SIGTERM', onTerminate);
  deps.signals.on('SIGHUP', onHangup);
  try {
    const deadline = Date.now() + readyTimeout;
    let ready = false;
    while (!exited && !interrupted && Date.now() < deadline) {
      // The marker is emitted by this child only after it owns the listener.
      // Another process already using the port cannot satisfy startup.
      if (listening && await deps.probeReady() && !exited && !interrupted) {
        ready = true;
        break;
      }
      await Promise.race([sleep(pollInterval), finished, interruption]);
    }
    if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
    if (!ready) {
      if (spawnError) throw new Error(`Could not start Appy: ${spawnError.message}`);
      if (exited) throw new Error(`Appy exited before it was ready (${exitSignal ?? `exit ${exitCode}`}). See the server error above.`);
      throw new Error('Appy did not become ready in time. Its process has been stopped; check the server output above.');
    }
    deps.stdout(`\nReady: ${url}\n`);
    let opened = false;
    try { opened = await deps.openBrowser(url); } catch { /* A browser failure must not stop the server. */ }
    if (!opened) deps.stderr(`Could not open your browser automatically. Open ${url} manually. Appy is still running.\n`);
    await Promise.race([finished, interruption]);
    if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
    if (spawnError) throw new Error(`Appy stopped: ${spawnError.message}`);
    if (exitCode !== 0) throw new Error(`Appy stopped (${exitSignal ?? `exit ${exitCode}`}). See the server output above.`);
    return 0;
  } finally {
    await stopChild();
    deps.signals.off('SIGINT', onInterrupt);
    deps.signals.off('SIGTERM', onTerminate);
    deps.signals.off('SIGHUP', onHangup);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await startAppy();
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  }
}
