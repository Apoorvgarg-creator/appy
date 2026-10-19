import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export function validateMobileOrigin(value) {
  if (value === '') return '';
  let url;
  try { url = new URL(value); } catch { /* Report one actionable validation error below. */ }
  const labels = url?.hostname.split('.') ?? [];
  if (!url || url.protocol !== 'https:' || url.origin !== value || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash || url.port || url.hostname.length > 253
    || labels.length !== 4 || !url.hostname.endsWith('.ts.net')
    || !labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Use the exact private HTTPS address, such as https://mac-mini.example.ts.net (no trailing slash or port).');
  }
  return value;
}

export async function readMobileOrigin(root, environment = process.env) {
  if (Object.hasOwn(environment, 'APPY_MOBILE_ORIGIN')) return validateMobileOrigin(environment.APPY_MOBILE_ORIGIN);
  const file = path.join(root, '.data/mobile-origin');
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.size > 512) throw new Error('Invalid .data/mobile-origin file; run npm run mobile -- off to remove it.');
    return validateMobileOrigin((await readFile(file, 'utf8')).trim());
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

export async function saveMobileOrigin(root, value) {
  const file = path.join(root, '.data/mobile-origin');
  if (value === 'off') {
    await rm(file, { force: true });
    return;
  }
  validateMobileOrigin(value);
  if (!value) throw new Error('Supply a private HTTPS address, or off.');
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${value}\n`, { flag: 'wx', mode: 0o600 });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: npm run mobile -- https://YOUR-MAC.YOUR-TAILNET.ts.net\nDisable: npm run mobile -- off');
    await saveMobileOrigin(repositoryRoot, process.argv[2]);
    console.log(process.argv[2] === 'off'
      ? 'Mobile access disabled for the next launch. Restart Appy to disconnect current sessions.'
      : 'Private address saved. Restart Appy, then open Runner → Connect a phone.\nTailscale Serve must separately point to http://127.0.0.1:8788.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
