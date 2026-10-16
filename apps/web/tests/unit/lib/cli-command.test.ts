// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { cliCommand } from '@/lib/suite-transport';
import {
  PLACEHOLDER_TARGET_URL,
  cliFireCommand,
  cliScenarioCommand,
  cliTestCommand,
  shellArg,
} from '@/lib/cli-command';

describe('shellArg', () => {
  it('leaves plain URLs alone', () => {
    expect(shellArg('https://staging.example.com/webhooks/stripe')).toBe(
      'https://staging.example.com/webhooks/stripe',
    );
  });

  it('single-quotes what a shell would read differently', () => {
    expect(shellArg('https://example.com/hook?token=a&b=1')).toBe("'https://example.com/hook?token=a&b=1'");
    expect(shellArg('http://[::1]:3000/hook')).toBe("'http://[::1]:3000/hook'");
    expect(shellArg('order note=first gift')).toBe("'order note=first gift'");
  });

  it('escapes single quotes inside a quoted argument', () => {
    expect(shellArg("it's")).toBe(`'it'\\''s'`);
  });

  it('quotes URLs exactly as the run-suite hint does', () => {
    for (const url of [
      'http://localhost:3000/webhooks',
      'https://example.com/hook?x=1&y=2',
      'http://[::1]:8080/',
      "https://example.com/it's",
    ]) {
      expect(cliCommand(url)).toBe(`npx @sutyr/webhook-lab test ${shellArg(url)}`);
    }
  });
});

describe('cliTestCommand', () => {
  it('is the CI command for the target', () => {
    expect(cliTestCommand('https://staging.example.com/webhooks')).toBe(
      'npx @sutyr/webhook-lab test https://staging.example.com/webhooks --secret "$STRIPE_WEBHOOK_SECRET"',
    );
  });

  it('trims the URL and falls back to a placeholder when there is none', () => {
    expect(cliTestCommand('  http://localhost:3000/webhooks ')).toBe(
      'npx @sutyr/webhook-lab test http://localhost:3000/webhooks --secret "$STRIPE_WEBHOOK_SECRET"',
    );
    expect(cliTestCommand('')).toBe(
      `npx @sutyr/webhook-lab test ${PLACEHOLDER_TARGET_URL} --secret "$STRIPE_WEBHOOK_SECRET"`,
    );
  });
});

describe('cliScenarioCommand', () => {
  it('names the scenario before the URL', () => {
    expect(cliScenarioCommand('subscription-failure', 'http://localhost:3000/webhooks')).toBe(
      'npx @sutyr/webhook-lab scenario subscription-failure http://localhost:3000/webhooks --secret "$STRIPE_WEBHOOK_SECRET"',
    );
  });
});

describe('cliFireCommand', () => {
  it('fires the event type at the URL', () => {
    expect(cliFireCommand('invoice.payment_failed', 'http://localhost:3000/webhooks')).toBe(
      'npx @sutyr/webhook-lab fire invoice.payment_failed http://localhost:3000/webhooks --secret "$STRIPE_WEBHOOK_SECRET"',
    );
  });

  it('carries the editor options as --set flags', () => {
    expect(
      cliFireCommand('invoice.payment_failed', 'http://localhost:3000/webhooks', {
        amount: 4999,
        declineCode: 'insufficient_funds',
        livemode: true,
      }),
    ).toBe(
      'npx @sutyr/webhook-lab fire invoice.payment_failed http://localhost:3000/webhooks' +
        ' --set amount=4999 --set declineCode=insufficient_funds --set livemode=true' +
        ' --secret "$STRIPE_WEBHOOK_SECRET"',
    );
  });

  it('leaves out cleared fields, since the generator default applies to them', () => {
    expect(cliFireCommand('charge.refunded', 'http://localhost/hook', { amountRefunded: '', currency: 'eur' })).toBe(
      'npx @sutyr/webhook-lab fire charge.refunded http://localhost/hook --set currency=eur --secret "$STRIPE_WEBHOOK_SECRET"',
    );
  });

  it('writes metadata as metadata.key=value and quotes values with spaces', () => {
    expect(
      cliFireCommand('charge.succeeded', 'http://localhost/hook', {
        metadata: { order_id: '1234', note: 'first order' },
      }),
    ).toBe(
      `npx @sutyr/webhook-lab fire charge.succeeded http://localhost/hook --set metadata.order_id=1234 --set 'metadata.note=first order' --secret "$STRIPE_WEBHOOK_SECRET"`,
    );
  });
});
