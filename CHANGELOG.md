# Changelog

All notable changes to Webhook Lab are documented here.

This project follows [Semantic Versioning](https://semver.org/).

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
- Zero telemetry, zero analytics in source

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
