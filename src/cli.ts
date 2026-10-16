// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// The webhook-lab command. It runs on the developer's machine, so unlike the
// hosted Lab it may reach localhost and private hosts. Zero dependencies:
// argument parsing is node:util parseArgs, delivery is the global fetch.
import { randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import {
  EVENT_CATALOG,
  EVENT_GENERATORS,
  SCENARIO_CATALOG,
  SCENARIO_GENERATORS,
  STRIPE_API_VERSION,
  type EventGenerator,
  type ScenarioGenerator,
  type StripeEventType,
} from '@webhook-lab/events';
import {
  CHECKS,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  deliverEvent,
  fetchTransport,
  runSuite,
  type CheckResult,
  type CheckStatus,
  type Delivery,
  type SuiteSummary,
} from '@webhook-lab/conformance';

// ─── IO ──────────────────────────────────────────────────────────────────────

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: Record<string, string | undefined>;
  /** Whether stdout is a terminal. Colours are only used when it is. */
  isTTY: boolean;
  columns: number;
}

function processIo(): CliIo {
  return {
    stdout: (text) => void process.stdout.write(text),
    stderr: (text) => void process.stderr.write(text),
    env: process.env,
    isTTY: Boolean(process.stdout.isTTY),
    columns: process.stdout.columns || 80,
  };
}

class UsageError extends Error {}

// ─── Help ────────────────────────────────────────────────────────────────────

const HELP = `webhook-lab: a test suite for your Stripe webhook handler

Usage
  webhook-lab test <url> [--secret whsec_...] [--only ids] [--json] [--timeout ms]
  webhook-lab fire <event-type> <url> [--secret whsec_...] [--set key=value ...]
  webhook-lab scenario <scenario-id> <url> [--secret whsec_...] [--seed text]
  webhook-lab payload <event-type> [--set key=value ...]
  webhook-lab list [events|scenarios|checks]

Commands
  test       Send signed, forged, stale, duplicate and out-of-order events and
             check how the handler responds
  fire       Send one signed event
  scenario   Send every step of a scenario in order, with shared IDs
  payload    Print an event as JSON without sending it
  list       Show the event types, scenarios and checks

Options
  --secret   Signing secret your handler verifies with. Defaults to the
             STRIPE_WEBHOOK_SECRET environment variable.
  --only     Comma-separated check ids to run (see webhook-lab list checks)
  --json     Print the test report as JSON
  --timeout  Milliseconds to wait for each response (default ${DEFAULT_TIMEOUT_MS})
  --set      Generator option as key=value. Numbers and true or false are
             parsed; metadata.key=value sets a metadata entry. Repeatable.
  --seed     Seed for scenario IDs. The same seed gives the same IDs.
  -h, --help     Show this help
  -v, --version  Show the version

Examples
  webhook-lab test http://localhost:3000/webhooks --secret whsec_test_123
  webhook-lab test http://localhost:3000/webhooks --only forged-signature-rejected,stale-timestamp-rejected
  webhook-lab fire invoice.payment_failed http://localhost:3000/webhooks --set amount=4999
  webhook-lab scenario subscription-failure http://localhost:3000/webhooks
  webhook-lab payload customer.subscription.updated --set status=past_due > event.json

Exit codes
  0  everything passed or returned 2xx
  1  a check failed or errored, or a delivery did not return 2xx
  2  the command line was not valid
`;

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Colour ──────────────────────────────────────────────────────────────────

interface Paint {
  green: (s: string) => string;
  red: (s: string) => string;
  yellow: (s: string) => string;
  dim: (s: string) => string;
  bold: (s: string) => string;
}

function painter(io: CliIo): Paint {
  // https://no-color.org: any non-empty NO_COLOR turns colour off.
  const enabled = io.isTTY && !io.env.NO_COLOR && io.env.TERM !== 'dumb';
  const wrap = (open: number, close: number) => (s: string) =>
    enabled ? `\x1b[${open}m${s}\x1b[${close}m` : s;
  return {
    green: wrap(32, 39),
    red: wrap(31, 39),
    yellow: wrap(33, 39),
    dim: wrap(2, 22),
    bold: wrap(1, 22),
  };
}

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: 'PASS',
  fail: 'FAIL',
  warn: 'WARN',
  error: 'ERROR',
};

function paintStatus(status: CheckStatus, paint: Paint): string {
  const label = STATUS_LABEL[status].padEnd(5);
  if (status === 'pass') return paint.green(label);
  if (status === 'warn') return paint.yellow(label);
  return paint.red(label);
}

function paintHttp(delivery: Delivery, paint: Paint): string {
  if (delivery.status === 0) return paint.red('ERR');
  const text = String(delivery.status);
  return delivery.status >= 200 && delivery.status < 300 ? paint.green(text) : paint.red(text);
}

// ─── Argument Helpers ────────────────────────────────────────────────────────

type Options = NonNullable<ParseArgsConfig['options']>;

interface Parsed {
  /** Option values; callers narrow each one before use. */
  values: Record<string, string | boolean | (string | boolean)[] | undefined>;
  positionals: string[];
}

function parse(args: string[], options: Options): Parsed {
  try {
    return parseArgs({
      args,
      options: { ...options, help: { type: 'boolean', short: 'h' } },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
}

function noExtra(extra: string[]): void {
  if (extra.length > 0) throw new UsageError(`Unexpected argument: ${extra[0]}`);
}

function requireUrl(raw: string | undefined): string {
  if (!raw) throw new UsageError('Missing <url>, for example http://localhost:3000/webhooks');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UsageError(`Not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UsageError(`Only http and https URLs are supported: ${raw}`);
  }
  return raw;
}

function resolveSecret(flag: unknown, io: CliIo): string {
  const secret = typeof flag === 'string' && flag !== '' ? flag : io.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new UsageError(
      'A signing secret is required. Pass --secret whsec_... or set STRIPE_WEBHOOK_SECRET.',
    );
  }
  return secret;
}

function parseTimeout(raw: unknown): number {
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;
  const ms = Number(raw);
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || ms <= 0) {
    throw new UsageError(`--timeout expects a whole number of milliseconds, got: ${String(raw)}`);
  }
  // Node runs a longer timer after 1 ms instead, which would fail every delivery.
  if (ms > MAX_TIMEOUT_MS) {
    throw new UsageError(`--timeout can be at most ${MAX_TIMEOUT_MS} milliseconds, got: ${raw}`);
  }
  return ms;
}

function parseOnly(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string') return undefined;
  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
  const known = new Set<string>(CHECKS.map((c) => c.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (ids.length === 0 || unknown.length > 0) {
    throw new UsageError(
      `Unknown check id: ${unknown.join(', ') || '(none given)'}. Run webhook-lab list checks to see them all.`,
    );
  }
  return ids;
}

function lookupGenerator(type: string | undefined): EventGenerator {
  if (!type) throw new UsageError('Missing <event-type>, for example invoice.payment_failed');
  const generator = Object.hasOwn(EVENT_GENERATORS, type)
    ? EVENT_GENERATORS[type as StripeEventType]
    : undefined;
  if (!generator) {
    throw new UsageError(`Unknown event type: ${type}. Run webhook-lab list events to see them all.`);
  }
  return generator;
}

function lookupScenario(id: string | undefined): ScenarioGenerator {
  if (!id) throw new UsageError('Missing <scenario-id>, for example subscription-failure');
  const generator = Object.hasOwn(SCENARIO_GENERATORS, id) ? SCENARIO_GENERATORS[id] : undefined;
  if (!generator) {
    throw new UsageError(`Unknown scenario: ${id}. Run webhook-lab list scenarios to see them all.`);
  }
  return generator;
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Turn repeated --set key=value flags into generator options. true and false
 * become booleans and plain decimal numbers become numbers; everything else
 * stays a string. metadata.key=value always stays a string, because Stripe
 * metadata values are strings.
 */
export function parseSetOptions(pairs: readonly string[] = []): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const key = eq > 0 ? pair.slice(0, eq).trim() : '';
    if (!key) throw new UsageError(`--set expects key=value, got: ${pair}`);
    const raw = pair.slice(eq + 1);

    if (key.startsWith('metadata.')) {
      const field = key.slice('metadata.'.length);
      if (!field || UNSAFE_KEYS.has(field)) throw new UsageError(`Not a valid metadata key: ${key}`);
      const existing = options.metadata;
      const metadata: Record<string, string> =
        existing && typeof existing === 'object' ? (existing as Record<string, string>) : {};
      metadata[field] = raw;
      options.metadata = metadata;
      continue;
    }

    if (UNSAFE_KEYS.has(key) || key.includes('.')) throw new UsageError(`Not a valid option name: ${key}`);
    options[key] = parseValue(raw);
  }
  return options;
}

/**
 * Build the event from --set options. Generators only throw for an option
 * value they do not know (an unknown decline code, for example), which is a
 * command line problem: exit 2, not the 1 that means a handler failed.
 */
function generateEvent(generate: EventGenerator, pairs: readonly string[] | undefined) {
  const options = parseSetOptions(pairs);
  try {
    return generate(options);
  } catch (err) {
    throw new UsageError(errorMessage(err));
  }
}

function parseValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n;
  }
  return raw;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Text Layout ─────────────────────────────────────────────────────────────

function wrap(text: string, width: number, indent: string): string {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.map((l) => `${indent}${l}`).join('\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[truncated, ${text.length} characters in total]`;
}

/** Response bodies come from the handler; keep its control characters off the terminal. */
function printable(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '?');
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function formatSummary(summary: SuiteSummary, paint: Paint): string {
  const parts = [
    paint.green(`${summary.pass} passed`),
    summary.fail > 0 ? paint.red(`${summary.fail} failed`) : `${summary.fail} failed`,
    summary.warn > 0 ? paint.yellow(plural(summary.warn, 'warning', 'warnings')) : plural(0, 'warning', 'warnings'),
    summary.error > 0 ? paint.red(plural(summary.error, 'error', 'errors')) : plural(0, 'error', 'errors'),
  ];
  return parts.join(', ');
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function commandTest(args: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parse(args, {
    secret: { type: 'string' },
    only: { type: 'string' },
    json: { type: 'boolean' },
    timeout: { type: 'string' },
  });
  if (values.help) return help(io);
  const [rawUrl, ...extra] = positionals;
  const url = requireUrl(rawUrl);
  noExtra(extra);
  const secret = resolveSecret(values.secret, io);
  const timeoutMs = parseTimeout(values.timeout);
  const only = parseOnly(values.only);
  const transport = fetchTransport({ timeoutMs });

  if (values.json) {
    const report = await runSuite({ url, secret, transport, only });
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    return report.summary.fail + report.summary.error > 0 ? 1 : 0;
  }

  const paint = painter(io);
  const selected = only ? CHECKS.filter((c) => only.includes(c.id)) : CHECKS;
  const titleWidth = Math.max(...selected.map((c) => c.title.length));
  const textWidth = Math.max(40, Math.min(io.columns, 100) - 9);

  io.stdout(`Testing ${url}\n${paint.dim(`Stripe API version ${STRIPE_API_VERSION}`)}\n\n`);

  const printResult = (r: CheckResult) => {
    io.stdout(`  ${paintStatus(r.status, paint)}  ${r.title.padEnd(titleWidth)}  ${r.observed}\n`);
    if (r.status === 'fail' || r.status === 'warn') {
      io.stdout(`${paint.dim(wrap(r.why, textWidth, ' '.repeat(9)))}\n`);
    }
  };

  const report = await runSuite({ url, secret, transport, only, onResult: printResult });
  io.stdout(`\n${formatSummary(report.summary, paint)}\n`);
  return report.summary.fail + report.summary.error > 0 ? 1 : 0;
}

async function commandFire(args: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parse(args, {
    secret: { type: 'string' },
    set: { type: 'string', multiple: true },
    timeout: { type: 'string' },
  });
  if (values.help) return help(io);
  const [type, rawUrl, ...extra] = positionals;
  const generate = lookupGenerator(type);
  const url = requireUrl(rawUrl);
  noExtra(extra);
  const secret = resolveSecret(values.secret, io);
  const timeoutMs = parseTimeout(values.timeout);
  const event = generateEvent(generate, values.set as string[] | undefined);

  const paint = painter(io);
  io.stdout(`POST ${url}\n${event.type}  ${paint.dim(event.id)}\n\n`);

  const delivery = await deliverEvent({ url, secret, event, transport: fetchTransport({ timeoutMs }) });
  if (delivery.status === 0) {
    io.stdout(`${paint.red('No response')}  ${delivery.error ?? ''}\n`);
    return 1;
  }
  io.stdout(`${paintHttp(delivery, paint)} in ${delivery.durationMs} ms\n`);
  if (delivery.responseBody) io.stdout(`${truncate(printable(delivery.responseBody), 500)}\n`);
  return delivery.status >= 200 && delivery.status < 300 ? 0 : 1;
}

/** Pause between scenario steps. Steps are sent in order, never in parallel. */
const SCENARIO_STEP_GAP_MS = 150;

async function commandScenario(args: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parse(args, {
    secret: { type: 'string' },
    seed: { type: 'string' },
    timeout: { type: 'string' },
  });
  if (values.help) return help(io);
  const [id, rawUrl, ...extra] = positionals;
  const generate = lookupScenario(id);
  const url = requireUrl(rawUrl);
  noExtra(extra);
  const secret = resolveSecret(values.secret, io);
  const timeoutMs = parseTimeout(values.timeout);

  // A fresh seed per run gives new customer, subscription and invoice IDs, so
  // repeated runs do not collide in the handler's database.
  const preset = generate({ seed: typeof values.seed === 'string' ? values.seed : randomUUID() });
  const transport = fetchTransport({ timeoutMs });
  const paint = painter(io);
  const total = preset.steps.length;
  const typeWidth = Math.max(...preset.steps.map((s) => s.event.type.length));
  const indexWidth = `${total}/${total}`.length;

  // Use the catalog name so this matches `webhook-lab list scenarios`.
  const name = SCENARIO_CATALOG.find((s) => s.id === id)?.name ?? preset.name;
  io.stdout(`${name}: ${plural(total, 'step', 'steps')} to ${url}\n\n`);

  let delivered = 0;
  for (const [i, step] of preset.steps.entries()) {
    if (i > 0) await sleep(SCENARIO_STEP_GAP_MS);
    const delivery = await deliverEvent({ url, secret, event: step.event, transport });
    const ok = delivery.status >= 200 && delivery.status < 300;
    if (ok) delivered += 1;
    const noResponse = delivery.status === 0;
    const timing = noResponse ? '' : `${delivery.durationMs} ms`;
    const reason = noResponse ? `  ${paint.red(delivery.error ?? 'No response')}` : '';
    io.stdout(
      `  ${`${i + 1}/${total}`.padStart(indexWidth)}  ${paintHttp(delivery, paint)}  ${timing.padStart(8)}  ` +
        `${step.event.type.padEnd(typeWidth)}  ${paint.dim(step.description)}${reason}\n`,
    );
  }

  const line = `${delivered} of ${total} steps returned 2xx`;
  io.stdout(`\n${delivered === total ? paint.green(line) : paint.red(line)}\n`);
  return delivered === total ? 0 : 1;
}

function commandPayload(args: string[], io: CliIo): number {
  const { values, positionals } = parse(args, { set: { type: 'string', multiple: true } });
  if (values.help) return help(io);
  const [type, ...extra] = positionals;
  const generate = lookupGenerator(type);
  noExtra(extra);
  const event = generateEvent(generate, values.set as string[] | undefined);
  io.stdout(`${JSON.stringify(event, null, 2)}\n`);
  return 0;
}

function commandList(args: string[], io: CliIo): number {
  const { values, positionals } = parse(args, {});
  if (values.help) return help(io);
  const [what, ...extra] = positionals;
  noExtra(extra);
  if (what !== undefined && what !== 'events' && what !== 'scenarios' && what !== 'checks') {
    throw new UsageError(`list takes events, scenarios or checks, got: ${what}`);
  }
  const paint = painter(io);
  const sections: string[] = [];

  if (!what || what === 'events') {
    // Catalog order first, then any generator the catalog does not list yet.
    const registered = Object.keys(EVENT_GENERATORS) as StripeEventType[];
    const ordered = [
      ...EVENT_CATALOG.map((e) => e.type).filter((t) => registered.includes(t)),
      ...registered.filter((t) => !EVENT_CATALOG.some((e) => e.type === t)),
    ];
    const width = Math.max(...ordered.map((t) => t.length));
    const rows = ordered.map((type) => {
      const category = EVENT_CATALOG.find((e) => e.type === type)?.category ?? '';
      return `  ${type.padEnd(width)}  ${paint.dim(category)}`.trimEnd();
    });
    sections.push(`Events (${ordered.length})\n${rows.join('\n')}`);
  }

  if (!what || what === 'scenarios') {
    const ids = Object.keys(SCENARIO_GENERATORS);
    const width = Math.max(...ids.map((id) => id.length));
    const rows = ids.map((id) => {
      const entry = SCENARIO_CATALOG.find((s) => s.id === id);
      const detail = entry ? `${entry.name}, ${plural(entry.stepCount, 'step', 'steps')}` : '';
      return `  ${id.padEnd(width)}  ${paint.dim(detail)}`.trimEnd();
    });
    sections.push(`Scenarios (${ids.length})\n${rows.join('\n')}`);
  }

  if (!what || what === 'checks') {
    const width = Math.max(...CHECKS.map((c) => c.id.length));
    const rows = CHECKS.map((c) => `  ${c.id.padEnd(width)}  ${paint.dim(c.title)}`);
    sections.push(`Checks (${CHECKS.length})\n${rows.join('\n')}`);
  }

  io.stdout(`${sections.join('\n\n')}\n`);
  return 0;
}

function help(io: CliIo): number {
  io.stdout(HELP);
  return 0;
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Run the CLI with the given arguments (without `node` and the script path)
 * and return the exit code. Output goes through `io`, which tests replace.
 */
export async function main(argv: readonly string[], io: Partial<CliIo> = {}): Promise<number> {
  const cli: CliIo = { ...processIo(), ...io };
  const [command, ...rest] = argv;

  try {
    switch (command) {
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        return help(cli);
      case '--version':
      case '-v':
        cli.stdout(`${readVersion()}\n`);
        return 0;
      case 'test':
        return await commandTest(rest, cli);
      case 'fire':
        return await commandFire(rest, cli);
      case 'scenario':
        return await commandScenario(rest, cli);
      case 'payload':
        return commandPayload(rest, cli);
      case 'list':
        return commandList(rest, cli);
      default:
        throw new UsageError(`Unknown command: ${command}`);
    }
  } catch (err) {
    if (err instanceof UsageError) {
      cli.stderr(`webhook-lab: ${err.message}\nRun webhook-lab --help for usage.\n`);
      return 2;
    }
    cli.stderr(`webhook-lab: ${errorMessage(err)}\n`);
    return 1;
  }
}

/** True when this file is the script node was asked to run, not an import. */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    // npm and pnpm install bins as symlinks; node runs the resolved file.
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  // `webhook-lab payload ... | head` closes stdout early; that is not an error.
  process.stdout.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') process.exit(0);
    throw err;
  });
  // Set exitCode instead of calling exit() so piped output is flushed first.
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
