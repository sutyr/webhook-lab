# Webhook Lab

A test suite for your Stripe webhook handler.

Webhook Lab sends your handler the requests a Stripe endpoint has to cope with: a correctly signed event, a forged signature, a missing signature, a body changed after signing, a stale timestamp, a duplicate delivery, events out of order and an event type you do not handle. It reports the status code and timing of each response and tells you what to fix. It also generates 39 Stripe event types at API version `2026-09-30.endive`, signed exactly the way Stripe signs them, for your own tests. No Stripe account, no signup.

[![Tests](https://img.shields.io/badge/tests-1770-brightgreen)](https://github.com/sutyr/webhook-lab)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](package.json)

[![Webhook Lab suite mode: a run against an endpoint that accepts forged, missing, tampered and stale signatures, 5 of 9 checks passed](https://raw.githubusercontent.com/sutyr/webhook-lab/main/docs/screenshot.png)](https://lab.sutyr.com)

## Quick start

Start your app, then point the suite at its webhook route with the signing secret the handler verifies with:

```bash
npx @sutyr/webhook-lab test http://localhost:3000/webhooks --secret "$STRIPE_WEBHOOK_SECRET"
```

Node 22 or later. The CLI runs on your machine, so it reaches `localhost`, private networks and CI services. `--secret` falls back to the `STRIPE_WEBHOOK_SECRET` environment variable. For local testing any `whsec_` value works, as long as your handler is started with the same one.

Output for a handler that checks the signature but not its timestamp:

```text
Testing http://localhost:3000/webhooks
Stripe API version 2026-09-30.endive

  PASS   Accepts a correctly signed event          200 in 46 ms
  PASS   Rejects a forged signature                400 in 2 ms
  PASS   Rejects a missing signature               400 in 5 ms
  PASS   Rejects a body changed after signing      400 in 2 ms
  FAIL   Rejects a stale timestamp                 200 in 4 ms, accepted
         The timestamp in the Stripe-Signature header is signed too, so old
         deliveries can be refused. This event is correctly signed but 10
         minutes old, and Stripe's libraries reject anything older than 5
         minutes by default. Accepting it lets anyone who captured one real
         delivery replay it later. Stripe signs every attempt, retries included,
         with a fresh timestamp, so a tolerance never drops a real retry.
  PASS   Acknowledges a duplicate delivery         first 200, second 200
  PASS   Acknowledges events out of order          updated 200, created 200
  PASS   Acknowledges an event it does not handle  200 in 5 ms
  PASS   Responds in time                          46 ms

8 passed, 1 failed, 0 warnings, 0 errors
```

Exit codes: `0` when nothing failed or errored (warnings do not fail the run), `1` when a check failed or got no answer, `2` when the command line was not valid. Add `--json` for a machine-readable report, `--only` to run some checks, and `--timeout` to change the 10 second wait per response.

## What the checks prove

A full run sends 10 requests, one at a time, about 150 ms apart. Every request carries `Content-Type: application/json`, the `User-Agent` Stripe sends (`Stripe/1.0 (+https://stripe.com/docs/webhooks)`) and an `X-Webhook-Lab-Request-Id` header so you can find it in your logs. Redirects are not followed, because Stripe counts a 3xx as a failed delivery.

| Check | What the Lab sends | Passes when | A pass does not prove |
|-------|--------------------|-------------|-----------------------|
| `valid-event-accepted` | `invoice.payment_failed`, signed with your secret and the current time | 2xx | That the handler did the right thing with the event |
| `forged-signature-rejected` | The same event signed with a different, random `whsec_` secret | 4xx | That nothing ran before verification failed |
| `missing-signature-rejected` | An event with no `Stripe-Signature` header | 4xx | Anything about the other ways a signature can be wrong |
| `tampered-body-rejected` | A genuine signature for one event, sent with `amount_due` raised after signing | 4xx | That the handler reads the raw body in every code path |
| `stale-timestamp-rejected` | A correctly signed event whose signature timestamp is 10 minutes old | 4xx | Which tolerance the handler uses, only that 10 minutes is outside it |
| `duplicate-delivery-acknowledged` | `invoice.paid` twice with the same event id, each signed with a fresh timestamp | 2xx for both | That the handler skipped the second one: the Lab sees status codes, not side effects |
| `out-of-order-acknowledged` | `customer.subscription.updated` before `customer.subscription.created` for the same subscription | 2xx for both | That the handler ends up with the right state |
| `unhandled-event-acknowledged` | `charge.dispute.updated`, which most SaaS handlers ignore | 2xx | Anything about event types the handler does handle |
| `responds-in-time` | Measured on the correctly signed request | Under 2 seconds | How the handler behaves under load |

How results are graded:

- **Pass**: the handler did what Stripe expects.
- **Fail**: it would lose events or let forged ones in.
- **Warning**: it works, but not the way Stripe recommends. A rejection answered with a 5xx is a warning, because the event was refused but the verification error probably went uncaught. Out-of-order events answered with a non-2xx are a warning, because asking Stripe to retry later works in some designs. A response between 2 and 10 seconds is a warning; over 10 seconds, or no answer within the timeout, fails.
- **Error**: no answer arrived (connection refused, DNS failure), so nothing was judged.

A rejection check only counts if the correctly signed event was accepted. A handler that refuses every request gets warnings, not passes, on the rejection checks.

The time thresholds are the Lab's recommendation. Stripe asks endpoints to return a 2xx quickly, before any slow work, but publishes no general timeout. Stripe's own facts behind the other checks: it retries non-2xx deliveries for up to three days in live mode, its libraries reject signatures older than 5 minutes by default, it signs every attempt with a fresh timestamp, and it does not guarantee delivery order or exactly-once delivery ([Stripe webhooks documentation](https://docs.stripe.com/webhooks)).

The suite evaluates HTTP behaviour only: status codes and timing. It cannot see your database, emails or queues, so it cannot tell you whether the handler's business logic is right.

## Use it in CI

Start your app with a test signing secret, wait for it to listen, and run the suite. A failed or errored check exits with `1` and fails the job.

```yaml
name: Webhook handler

on: [push, pull_request]

jobs:
  webhook-lab:
    runs-on: ubuntu-latest
    env:
      # Any whsec_ value works, as long as the handler under test verifies with it.
      STRIPE_WEBHOOK_SECRET: whsec_ci_only_not_a_real_secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - name: Start the app
        run: npm start &
      - name: Wait for the app
        run: |
          for i in $(seq 1 30); do
            curl -s -o /dev/null http://localhost:3000 && exit 0
            sleep 1
          done
          echo "The app did not start" && exit 1
      - name: Run Webhook Lab
        run: npx @sutyr/webhook-lab test http://localhost:3000/webhooks
```

To keep the report as a build artifact, run `npx @sutyr/webhook-lab test http://localhost:3000/webhooks --json > webhook-lab-report.json` and upload the file.

## More commands

```bash
# Send one signed event. --set passes generator options; metadata.key=value sets metadata.
npx @sutyr/webhook-lab fire invoice.payment_failed http://localhost:3000/webhooks --set amount=4999

# Send every step of a scenario in order, with shared IDs. A fresh seed gives new IDs each run.
npx @sutyr/webhook-lab scenario subscription-failure http://localhost:3000/webhooks

# Print an event as JSON without sending it.
npx @sutyr/webhook-lab payload customer.subscription.updated --set status=past_due > event.json

# List the event types, scenarios and checks.
npx @sutyr/webhook-lab list
```

`fire` and `scenario` also take `--secret` and fall back to `STRIPE_WEBHOOK_SECRET`. Run `npx @sutyr/webhook-lab --help` for every option.

## Use it as a library

```bash
npm install --save-dev @sutyr/webhook-lab
```

Every event type has a typed factory. Call it with no options for a complete event, or pass only the fields you care about:

```typescript
import { paymentIntentPaymentFailed, sign } from '@sutyr/webhook-lab';

const secret = 'whsec_test_secret';
const event = paymentIntentPaymentFailed({ declineCode: 'insufficient_funds', amount: 4999 });

event.data.object.last_payment_error?.decline_code; // 'insufficient_funds'

await fetch('http://localhost:3000/webhooks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': sign(event, secret),
  },
  // sign() covers JSON.stringify(event), so send exactly that string.
  body: JSON.stringify(event),
});
```

Factories accept the IDs of related objects, so one test can tell a connected story:

```typescript
import { invoicePaymentFailed, subscriptionUpdated } from '@sutyr/webhook-lab';

const pastDue = subscriptionUpdated({ status: 'past_due', previousStatus: 'active' });
const invoice = invoicePaymentFailed({
  subscriptionId: pastDue.data.object.id,
  attemptCount: 2,
});
```

Scenarios return every step with shared IDs (`subscriptionHappyPath({ seed: 'ci-run-42' }).steps`), and `verify(rawBody, header, secret, toleranceSeconds?)` checks a `Stripe-Signature` header the way Stripe's libraries do, accepting any matching `v1` entry so it works during secret rotation.

The suite is available from code too, for example inside your own test runner:

```typescript
import { fetchTransport, runSuite } from '@sutyr/webhook-lab';

const report = await runSuite({
  url: 'http://localhost:3000/webhooks',
  secret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  transport: fetchTransport({ timeoutMs: 5000 }),
});

for (const result of report.results) console.log(result.status, result.id, result.observed);
```

The package has zero runtime dependencies. Signing uses Node's built-in `crypto`.

## The hosted Lab

[lab.sutyr.com](https://lab.sutyr.com) runs the same suite and generators in the browser, with three tabs:

- **Suite**: enter a public URL and its signing secret, run the checks and read each result with the requests sent and the responses received. It shows the matching CLI command to copy.
- **Scenarios**: run one of the 8 scenarios step by step and see each response.
- **Events**: pick any of the 39 events, edit its fields, preview the JSON, fire it, replay it with the same event id, and export it as cURL, TypeScript or Python. The URL updates as you edit, so a link reproduces the same event for a teammate.

The hosted Lab can only reach public URLs. When the target is `localhost` or a private address, it shows the CLI command to run instead. Suite runs are limited to 6 per minute per IP address.

The Lab's server does not store or log your payloads, signing secrets, target URLs or the responses it receives; they are processed in memory for the duration of the request. Your browser keeps the last target URL and signing secret in `localStorage` so the form is filled next time; Clear saved data, under Settings, removes them. The Lab sets no cookies. The hosted instance counts aggregate page views with cookieless analytics; self-hosted instances collect nothing. Details are on the [legal and trust page](https://lab.sutyr.com/legal).

## Event coverage

39 of the 268 event types Stripe lists for API version `2026-09-30.endive`: the core billing set. Payloads are snapshot events (the `Event` object with the full resource in `data.object`), not thin events.

| Category | Events |
|----------|--------|
| Payments (8) | `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.requires_action`, `payment_intent.canceled`, `charge.succeeded`, `charge.failed`, `charge.refunded`, `refund.created` |
| Invoices (11) | `invoice.upcoming`, `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.payment_succeeded`, `invoice_payment.paid`, `invoice.overdue`, `invoice.marked_uncollectible`, `invoice.voided` |
| Subscriptions (6) | `customer.subscription.created`, `customer.subscription.trial_will_end`, `customer.subscription.updated`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.deleted` |
| Checkout (4) | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` |
| Customers (3) | `customer.created`, `customer.updated`, `customer.deleted` |
| Payment methods (3) | `payment_method.attached`, `setup_intent.succeeded`, `payment_method.automatically_updated` |
| Disputes and fraud (4) | `radar.early_fraud_warning.created`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` |

## Scenarios

Each scenario derives every ID from one seed, so the same customer, subscription, invoice and charge IDs appear in every step that refers to them. The CLI picks a new seed for each run unless you pass `--seed`.

| Scenario | Id | Steps | What happens |
|----------|----|:-----:|--------------|
| Subscription happy path | `subscription-happy-path` | 7 | Customer created, subscription created, first invoice created, charged and paid |
| Failed payment dunning | `subscription-failure` | 7 | Invoice payment fails twice, subscription goes `past_due`, then is canceled |
| Checkout flow | `checkout-flow` | 3 | Checkout session completed, payment intent succeeded, charge succeeded |
| Dispute lifecycle | `dispute-lifecycle` | 4 | Charge succeeded, dispute opened, moved to `under_review`, closed as won |
| Refund flow | `refund-flow` | 2 | Charge succeeded, then fully refunded |
| Trial conversion | `trial-conversion` | 7 | Subscription created trialing, trial ending notice, active at trial end, first invoice finalized and paid |
| 3D Secure authentication | `3d-secure` | 6 | Renewal invoice finalized, payment needs authentication, customer authenticates, invoice paid |
| Early fraud warning | `early-fraud-warning` | 4 | Charge succeeded, issuer flags likely fraud, charge refunded in full before any dispute |

## Schema accuracy

Every generator is checked against Stripe's OpenAPI specification for `2026-09-30.endive`: field names, nullability, enum values, ID prefixes (`pi_`, `ch_`, `in_`, `sub_`, `cus_`, `dp_`, `re_`, `pm_`, `seti_`, `issfr_`, `inpay_`) and nested shapes. Since API `2025-03-31.basil` an Invoice has no `subscription` or `payment_intent` field: the subscription sits at `parent.subscription_details.subscription` and payments are linked through `invoice_payment` objects, and the generators follow that model.

One example of the detail involved: `payment_intent.payment_failed` with `insufficient_funds` produces `code: 'card_declined'` and `decline_code: 'insufficient_funds'` on `last_payment_error`. With `expired_card` the code is `expired_card` and `decline_code` is absent, not null. A Charge has no `decline_code` at all; `charge.failed` reports `failure_code` and `outcome`.

The test suite has 1770 tests:

- **744 event tests**: every generator's fields, types, enums and ID prefixes, option handling, and ID continuity across scenario steps
- **273 schema validation tests**: structural contracts for every event type
- **94 cross-package tests**: sign-then-verify round trips for every event type and scenario correlation
- **10 Stripe SDK tests**: signatures verified end to end with Stripe's official `constructEvent`
- **35 CLI tests**: every command against a local HTTP server
- **40 signature tests**: Stripe's documented test vectors, tolerance boundaries, malformed headers, secret rotation
- **46 conformance tests**: every check's verdicts, transport timeouts and body caps
- **528 web tests**: API routes, SSRF protection and connection pinning, rate limiting, input validation, URL state and export formats

Found a payload that does not match what Stripe sends? Schema accuracy bugs are treated as P0. Open an issue with the event type, the field and evidence from Stripe's documentation or a real event.

## Self-hosting

```bash
git clone https://github.com/sutyr/webhook-lab.git
cd webhook-lab
pnpm install
pnpm --filter "./packages/*" build
pnpm --filter @webhook-lab/web dev
```

Open `http://localhost:3000`. Set `WEBHOOK_LAB_ALLOW_PRIVATE=true` to let your instance reach `localhost` and private networks. Set `WEBHOOK_LAB_DISABLE_FIRE=true` to stop all outbound requests. Analytics stay off unless you set `WEBHOOK_LAB_ANALYTICS=true`.

## Scope

Webhook Lab generates Stripe events, delivers them and evaluates how your endpoint responds at the HTTP level. It does not decide how your business should react to an event, and it contains no billing logic, retry timing or classification from the [Sutyr](https://sutyr.com) platform.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributors must agree to the [CLA](CLA.md).

## License

Webhook Lab is open source, licensed under the [Apache License 2.0](LICENSE).

The [Sutyr](https://sutyr.com) billing orchestration platform is a separate proprietary product. Use of Webhook Lab does not grant any license to Sutyr's proprietary software, trade secrets or platform services.

This project is not developed, maintained, endorsed or sponsored by Stripe, Inc. Stripe is a registered trademark of Stripe, Inc. Event schemas are derived from Stripe's publicly available [API documentation](https://docs.stripe.com/api).
