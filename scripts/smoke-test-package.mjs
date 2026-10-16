// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
//
// Packs @sutyr/webhook-lab, installs the tarball into an empty project outside
// the workspace, and uses it the way someone installing it from npm would: the
// CLI against local handlers, the library import, and the type declarations.
// Run after `pnpm build:pkg`: node scripts/smoke-test-package.mjs

import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'webhook-lab-smoke-'));
const SECRET = 'whsec_smoke_test';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

// Under `npm publish`, npm passes its own settings to lifecycle scripts as
// npm_config_* variables (dry_run among them), and a nested npm would inherit
// them. Run every command as a fresh shell would.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_')),
);

/** Runs a command, resolving with its exit code instead of throwing. */
async function run(cmd, args, cwd) {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      cwd,
      env: cleanEnv,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: typeof err.code === 'number' ? err.code : 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => handler(req, body, res));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const servers = [];
try {
  // 1. Pack and install into an empty project. The package has no runtime
  //    dependencies, so this needs no network.
  const packed = await run('npm', ['pack', '--silent', '--pack-destination', work], root);
  const tarball = packed.stdout.trim().split('\n').pop();
  check('npm pack', packed.code === 0 && tarball.endsWith('.tgz'), tarball);

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'smoke', private: true, type: 'module' }));
  const installed = await run('npm', ['install', '--no-audit', '--no-fund', '--silent', join(work, tarball)], work);
  check('npm install of the tarball', installed.code === 0, installed.stderr?.trim().slice(0, 200));
  if (installed.code !== 0) throw new Error('Cannot continue without an installed package.');

  const bin = join(work, 'node_modules', '.bin', 'webhook-lab');
  const lib = join(work, 'node_modules', pkg.name);
  const installedPkg = JSON.parse(readFileSync(join(lib, 'package.json'), 'utf8'));
  check('installed package has no runtime dependencies', !installedPkg.dependencies, JSON.stringify(installedPkg.dependencies ?? {}));

  // 2. CLI basics.
  const version = await run(bin, ['--version'], work);
  check('webhook-lab --version', version.stdout.trim() === pkg.version, version.stdout.trim());

  const help = await run(bin, ['--help'], work);
  check('webhook-lab --help', help.code === 0 && help.stdout.includes('webhook-lab test'));

  const events = await run(bin, ['list', 'events'], work);
  check('webhook-lab list events', events.code === 0 && /Events \(39\)/.test(events.stdout), events.stdout.split('\n')[0]);

  const payload = await run(bin, ['payload', 'invoice_payment.paid'], work);
  let parsed = null;
  try {
    parsed = JSON.parse(payload.stdout);
  } catch {}
  check(
    'webhook-lab payload invoice_payment.paid',
    parsed?.type === 'invoice_payment.paid' && parsed?.data?.object?.object === 'invoice_payment',
    parsed?.api_version,
  );

  // 3. The suite against a handler that verifies signatures with the package's
  //    own verify(), dedupes on event.id and acknowledges everything else.
  const { verify } = await import(join(lib, 'dist', 'index.js'));
  const correct = await listen((req, body, res) => {
    const ok = verify(body, String(req.headers['stripe-signature'] ?? ''), SECRET, 300);
    res.writeHead(ok ? 200 : 400).end(ok ? 'ok' : 'bad signature');
  });
  const naive = await listen((_req, _body, res) => res.writeHead(200).end('ok'));
  servers.push(correct, naive);

  const good = await run(bin, ['test', `http://127.0.0.1:${correct.address().port}/webhooks`, '--secret', SECRET, '--json'], work);
  const goodReport = JSON.parse(good.stdout || '{}');
  check('webhook-lab test, verifying handler: all pass, exit 0', good.code === 0 && goodReport.summary?.fail === 0, JSON.stringify(goodReport.summary));

  const bad = await run(bin, ['test', `http://127.0.0.1:${naive.address().port}/webhooks`, '--secret', SECRET, '--json'], work);
  const badReport = JSON.parse(bad.stdout || '{}');
  check('webhook-lab test, naive handler: signature checks fail, exit 1', bad.code === 1 && badReport.summary?.fail === 4, JSON.stringify(badReport.summary));

  // 4. Library import from a consumer project.
  writeFileSync(
    join(work, 'consumer.mjs'),
    `import { paymentIntentPaymentFailed, sign, verify, runSuite, CHECKS, EVENT_CATALOG, STRIPE_API_VERSION } from '${pkg.name}';
const event = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' });
const header = sign(event, 'whsec_x');
if (!verify(JSON.stringify(event), header, 'whsec_x')) throw new Error('round trip failed');
if (typeof runSuite !== 'function' || CHECKS.length !== 9) throw new Error('suite exports missing');
console.log(EVENT_CATALOG.length, STRIPE_API_VERSION);\n`,
  );
  const consumer = await run('node', ['consumer.mjs'], work);
  check('library import, sign and verify', consumer.code === 0 && consumer.stdout.trim() === '39 2026-09-30.endive', consumer.stdout.trim() || consumer.stderr);

  // 5. Type declarations resolve for a strict TypeScript consumer.
  writeFileSync(
    join(work, 'consumer.ts'),
    `import { paymentIntentPaymentFailed, runSuite, fetchTransport, type SuiteReport } from '${pkg.name}';
const event = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds' });
const declineCode: string | undefined = event.data.object.last_payment_error?.decline_code;
const report: Promise<SuiteReport> = runSuite({ url: 'http://localhost:3000', secret: 'whsec_x', transport: fetchTransport() });
void declineCode; void report;\n`,
  );
  const tsc = await run(
    join(root, 'node_modules', '.bin', 'tsc'),
    ['--noEmit', '--strict', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022',
      '--types', 'node', '--typeRoots', join(root, 'node_modules', '@types'), 'consumer.ts'],
    work,
  );
  check('type declarations compile under strict nodenext', tsc.code === 0, (tsc.stdout || tsc.stderr || '').trim().slice(0, 300));
} catch (err) {
  check('smoke test completed', false, err instanceof Error ? err.message : String(err));
} finally {
  for (const s of servers) s.close();
  rmSync(work, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nPackage smoke test passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
