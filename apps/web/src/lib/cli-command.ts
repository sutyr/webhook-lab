// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// Commands for the webhook-lab CLI, which runs on the developer's machine and
// can reach localhost, private networks and CI services the hosted Lab cannot.

export const CLI = 'npx @sutyr/webhook-lab';

/** Shown in commands until the user enters a target URL. */
export const PLACEHOLDER_TARGET_URL = 'https://your-server.com/webhook';

/**
 * The secret flag every command carries. The CLI also reads the variable on
 * its own, but spelling it out shows where the secret comes from in CI.
 * Quoted, so an unset variable reaches the CLI as an empty value and gets its
 * "a signing secret is required" message; unquoted, the shell drops the word
 * and the CLI can only say that --secret is missing its argument.
 */
const SECRET_FLAG = '--secret "$STRIPE_WEBHOOK_SECRET"';

/**
 * Quote one argument for a POSIX shell. Plain URL and option characters pass
 * through; anything a shell would read differently (?, &, #, brackets,
 * spaces, quotes) gets single quotes. Same rule as the run-suite route's hint.
 */
export function shellArg(value: string): string {
  if (/^[\w.:/@%+=,~-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function target(url: string): string {
  return shellArg(url.trim() || PLACEHOLDER_TARGET_URL);
}

/** `webhook-lab test`: the conformance suite. */
export function cliTestCommand(url: string): string {
  return `${CLI} test ${target(url)} ${SECRET_FLAG}`;
}

/** `webhook-lab scenario`: every step of a scenario, with shared IDs. */
export function cliScenarioCommand(scenarioId: string, url: string): string {
  return `${CLI} scenario ${shellArg(scenarioId)} ${target(url)} ${SECRET_FLAG}`;
}

/**
 * `webhook-lab fire`: one event, carrying the editor's options as --set flags
 * so the CLI generates the same payload. Empty values are left out because
 * the generator default applies to them, as it does in the editor. Metadata
 * becomes metadata.key=value, the form the CLI reads.
 */
export function cliFireCommand(
  eventType: string,
  url: string,
  options: Record<string, unknown> = {},
): string {
  const sets: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    if (key === 'metadata' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [field, entry] of Object.entries(value)) {
        if (field !== '' && (typeof entry === 'string' || typeof entry === 'number')) {
          sets.push(`metadata.${field}=${entry}`);
        }
      }
      continue;
    }
    if (value === '' || value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sets.push(`${key}=${value}`);
    }
  }
  const setFlags = sets.map((pair) => ` --set ${shellArg(pair)}`).join('');
  return `${CLI} fire ${shellArg(eventType)} ${target(url)}${setFlags} ${SECRET_FLAG}`;
}
