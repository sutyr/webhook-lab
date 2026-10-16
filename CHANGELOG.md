# Changelog

All notable changes to Webhook Lab are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-16

Webhook Lab becomes a test suite for your Stripe webhook handler. It checks how a handler responds to correctly signed, forged, stale, duplicate and out-of-order deliveries, ships a CLI that reaches `localhost` and CI, and covers 39 event types at Stripe API version `2026-09-30.endive`.

### Scope

- The Lab now evaluates the HTTP behaviour of the target endpoint: status codes and response time. It still contains no billing handling logic, retry timing or classification.

### Conformance suite

- New `@webhook-lab/conformance` package with no runtime dependencies beyond the events and signatures packages. It is bundled into `@sutyr/webhook-lab`.
- 9 checks: `valid-event-accepted`, `forged-signature-rejected`, `missing-signature-rejected`, `tampered-body-rejected`, `stale-timestamp-rejected`, `duplicate-delivery-acknowledged`, `out-of-order-acknowledged`, `unhandled-event-acknowledged` and `responds-in-time`.
- Each check is graded pass, fail, warning or error, with the expected and observed result and an explanation of what to fix. Rejection checks only pass when the correctly signed event was accepted, so a handler that refuses everything gets warnings, not passes.
- A full run sends 10 requests one at a time, about 150 ms apart, with Stripe's `User-Agent`, an `X-Webhook-Lab-Request-Id` header and no redirect following. Response bodies are read up to 64 KB and kept up to 4 KB in the report.
- `runSuite`, `selectChecks`, `CHECKS`, `fetchTransport` and `deliverEvent` are exported from `@sutyr/webhook-lab`.

### CLI

- New `webhook-lab` command (`npx @sutyr/webhook-lab`) with no dependencies: `test`, `fire`, `scenario`, `payload` and `list`.
- Runs on your machine, so it reaches `localhost`, private networks and CI services.
- The signing secret comes from `--secret` or `STRIPE_WEBHOOK_SECRET`. `test` takes `--only`, `--json` and `--timeout`; `fire` and `payload` take `--set key=value`; `scenario` takes `--seed`.
- Exit codes: `0` when nothing failed, `1` when a check failed or got no answer or a delivery did not return 2xx, `2` for an invalid command line. Colour only on a terminal, and never with `NO_COLOR`.

### Stripe API version `2026-09-30.endive`

- Events carry `api_version: '2026-09-30.endive'`. The envelope previously claimed `2025-10-29.clover` while Invoice, Subscription, PaymentIntent and Charge still used pre-basil shapes.
- Invoice: drop `paid`, `subscription` and `payment_intent`; the subscription is at `parent.subscription_details.subscription`; add `status_transitions`, `period_start`, `period_end`, `subtotal`, `total` and `amount_overpaid`; `number` is null until the invoice is finalized.
- Invoice line items: `parent.subscription_item_details` and `pricing.price_details` replace `price` and `type`.
- Subscription: `current_period_start` and `current_period_end` move onto the items; add `start_date` and `cancellation_details`, and the dunning scenario ends with reason `payment_failed`.
- PaymentIntent and Charge: drop `invoice`. A failed PaymentIntent points `latest_charge` and `last_payment_error.charge` at the failed charge and includes `doc_url`. `charge.refunded` reports the refund through `amount_refunded`.
- Dispute `status` gains `prevented`.
- The event editor offers every Stripe dispute reason, the `incomplete_expired` subscription status and the `subscription_threshold` billing reason.

### Events

- 21 new event types, for 39 of the 268 that Stripe lists for `2026-09-30.endive`:
  - Payments: `payment_intent.requires_action`, `payment_intent.canceled`, `charge.failed`, `refund.created`
  - Invoices: `invoice.upcoming`, `invoice.finalized`, `invoice.payment_action_required`, `invoice_payment.paid`, `invoice.overdue`, `invoice.marked_uncollectible`, `invoice.voided`
  - Subscriptions: `customer.subscription.trial_will_end`, `customer.subscription.paused`, `customer.subscription.resumed`
  - Checkout: `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
  - Customers: `customer.deleted`
  - Payment methods, a new category: `payment_method.attached`, `setup_intent.succeeded`, `payment_method.automatically_updated`
  - Disputes and fraud: `radar.early_fraud_warning.created`
- Typed factories and option types for every new event, and `EVENT_GENERATORS` and `SCENARIO_GENERATORS` registries for picking one at runtime.

### Scenarios

- 3 new scenarios, for 8 in total: Trial conversion (7 steps), 3D Secure authentication (6 steps) and Early fraud warning (4 steps).
- In the new scenarios, an object that moves through several states keeps every unchanged field (nested IDs, `created`, client secrets) from step to step.

### Signatures

- `verify()` accepts a header when any `v1` signature matches. Stripe sends one `v1` entry per active secret while a secret is being rotated, and `verify()` previously compared only the last one, so a valid delivery could be rejected during rotation.

### Web UI

- Suite mode is the default view: enter a public URL and its signing secret, run the checks, and read each result with its status badge, the requests sent and the responses received. The matching CLI command is ready to copy.
- New `/api/run-suite` route. It validates the target against SSRF rules before every delivery, allows 6 runs per minute per IP on top of the general rate limit, finishes within the 60 second function limit, and honours the `WEBHOOK_LAB_DISABLE_FIRE` switch.
- `localhost` and private targets: the editor recognises them as you type and shows the CLI command to run instead, and the API refuses them with the same command in the error message.
- New hierarchy: sidebar tabs in the order Suite, Scenarios, Events (Cmd/Ctrl+1, 2, 3). Events sit in collapsible groups (Payments, Invoices, Subscriptions, Checkout, Customers, Payment methods, Disputes and fraud) instead of drill-down category pages. Search walks the matches with the arrow keys, and on small screens it opens in the sidebar drawer.
- One copper primary action per mode (Run checks, Run scenario, Fire event), each with the Cmd/Ctrl+Enter shortcut. Scenario and event editors show the CLI command for the same run.
- Field editors for all 39 event types. A shared link without an event or scenario opens the suite.

### Brand

- October 2026 Sutyr brand kit: the tonal-black Suture mark and outlined sutyr lockup replace the copper mark, set at a quieter size in the tool bar.
- Neutral grey surfaces and text in both themes, with muted text at 4.5:1 contrast or better. Copper is kept for the primary action, focus rings and the active tab.
- Instrument Serif removed. Sentence-case DM Sans section labels replace uppercase letterspaced mono labels, and UI copy has no middle dots or em dashes.
- Adaptive favicon, Apple touch icon, web manifest with maskable icons and a new Open Graph image.

### Package

- `@sutyr/webhook-lab` now ships the `webhook-lab` binary and the conformance API alongside the event factories and signing.
- All packages move to version 0.2.0.

### Testing

- 1758 tests: 744 event, 40 signature, 46 conformance, 516 web and 412 integration, including 35 CLI tests against a local HTTP server and end-to-end verification with Stripe's official SDK.

## [0.1.0] - Unreleased

Initial public release.

- **Hosted:** [lab.sutyr.com](https://lab.sutyr.com)
- **npm:** [@sutyr/webhook-lab](https://www.npmjs.com/package/@sutyr/webhook-lab)

### Event Generators

- 18 Stripe webhook event types across 6 categories (payments, billing, subscriptions, checkout, customers, disputes)
- Stripe-accurate schemas verified against Stripe API documentation
- Correct `code` vs `decline_code` distinction on payment failures
- Customizable entity IDs, metadata, card details, livemode, API version, billing reason, attempt count
- All generators accept `customerId`, `amount`, `currency`, `metadata` options
- Zero runtime dependencies

### Scenarios

- 5 billing lifecycle presets with correlated entity IDs across all steps
- Subscription Happy Path (7 steps): customer → subscription → invoice → charge → payment intent → invoice paid
- Failed Payment Dunning (7 steps): invoice fails → PI fails → subscription past_due → retry → canceled
- Checkout Flow (3 steps): session → payment intent → charge
- Dispute Lifecycle (4 steps): charge → dispute created → updated → closed
- Refund Flow (2 steps): charge → refund

### Signing

- HMAC-SHA256 signing compatible with Stripe's `constructEvent()`
- Timing-safe signature verification
- Stripe-Signature header format: `t={timestamp},v1={hex}`

### Web UI

- Three-panel Postman-style layout (sidebar, editor, response)
- Light and dark themes with FOUC prevention
- Drill-down category navigation with breadcrumbs
- Collapsible sidebar with icon-only mode
- JSON preview with syntax highlighting, line numbers, and edit mode
- Shareable URLs with auto-updating query parameters
- Export as cURL, TypeScript, and Python
- Copy buttons on all code blocks
- Replay button for idempotency testing
- Response history (20-entry session log) with restore and re-fire
- Coverage checklist tracking tested event types
- Educational empty states with status code guides
- Scenario runner with step-by-step progress and segmented progress bar
- Delay presets (Instant, Fast, Realistic, Slow)
- Keyboard shortcuts: Cmd+K (search), Cmd+Enter (fire), Cmd+1/2 (tabs), Escape (close)
- 14 CSS-only micro-animations with prefers-reduced-motion support

### Security

- SSRF protection: private IPs, cloud metadata, localhost, IPv4-mapped IPv6
- Request body size limit (512KB)
- Response body truncation (1MB)
- Rate limiting (60 req/min per IP)
- Request correlation IDs
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Cookieless, GDPR-friendly analytics; event payloads, signing secrets, and target URLs never stored or logged

### Testing

- 755 tests across unit, integration, schema validation, and security categories
- Signature compatibility with Stripe test vectors
- SSRF bypass coverage (IPv4, IPv6, IPv4-mapped, decimal, octal, hex representations)
- Entity ID correlation tests for all 5 scenarios
- Option propagation tests for all generator parameters
- LabContext reducer tests for all UI state transitions
- Boundary tests (body size, rate limits, signature tolerance)

### Legal

- Apache License 2.0
- SPDX headers on all source files
- CLA for contributors
