# Contributing to Webhook Lab

Thank you for your interest in contributing to Webhook Lab. This document explains how to contribute and what to expect during the process.

## Before You Start

All contributions require a signed Contributor License Agreement (CLA). When you open your first pull request, a CLA bot will prompt you to sign. The CLA grants Sutyr Inc. a license to use your contribution in both this open-source project and in Sutyr's proprietary products. You retain copyright ownership of your contribution. The full CLA text is available at [CLA.md](CLA.md).

## What We Accept

**Event generators.** New Stripe event types, improved payload accuracy, better field defaults. If Stripe documents an event type and we don't generate it yet, that's a welcome contribution.

**Scenario presets.** Multi-event sequences that demonstrate real billing flows. The more realistic the sequence, the better.

**Edge case documentation.** Descriptions of billing edge cases you've encountered in production. What happened, why it matters, and what breaks if unhandled. All edge case documentation files in `docs/edge-cases/` must include the following header as the first line:

```
> This document describes billing edge cases for educational and testing purposes. The classification logic, retry strategies, and orchestration rules that Sutyr applies to these edge cases in production are proprietary and are not included in this project.
```

This header defines the boundary between the open-source project (which documents problems) and the proprietary platform (which orchestrates responses). Contributions that cross this boundary will be rejected.

**Bug fixes.** Anything that makes the tool more accurate or reliable.

**Signing and verification improvements.** Better Stripe-Signature compatibility, additional verification utilities.

**Documentation.** README improvements, inline code documentation, usage examples.

## What We Don't Accept

**Telemetry or analytics.** This project contains zero tracking code. Contributions that add any form of analytics, telemetry, usage tracking, or external network calls not initiated by the user will be rejected.

**Authentication or account systems.** The tool is designed to work without authentication. Contributions that add login, signup, or account features will be rejected.

**Classification logic.** Contributions that add response classification (categorizing edge cases into response types such as "retry," "escalate," or "terminal"), retry timing logic, or orchestration behavior are outside the scope of this project. This project generates and documents billing events; it does not prescribe responses to them.

**Dependencies that phone home.** Any dependency that transmits data to an external service without explicit user action will be rejected.

## How to Contribute

1. **Fork the repository** and create a branch from `main`.

2. **Make your changes.** Follow the coding standards below. Event generators should produce structurally correct Stripe payloads — validate against Stripe's documentation.

3. **Write tests.** New event generators and scenario presets should include tests that verify payload structure. Signing changes should include verification tests.

4. **Ensure the build is clean:**
   ```bash
   pnpm test          # Unit + integration tests
   pnpm build         # Verify clean build
   ```

5. **Open a pull request.** Describe what you changed and why. Reference any relevant Stripe documentation or API changelog entries. Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`.

6. **Sign the CLA.** The CLA bot will comment on your pull request. Follow the instructions to sign. Your pull request cannot be merged until the CLA is signed.

7. **Code review.** A maintainer will review your pull request. We may suggest changes or ask questions. We aim to respond within a few days, though response times may vary.

## Coding Standards

- **TypeScript strict mode** — no `any` types, no type assertions without justification.
- **SPDX headers** — every new `.ts` or `.tsx` file must start with `// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0`
- **Zero runtime dependencies** — the `events` and `signatures` packages must remain dependency-free. Node `crypto` is the only permitted import.
- **Pure functions** — all event generator functions accept a plain options object and return a plain object. No side effects, no external calls, no framework-specific types.
- **Lucide icons only** — no emoji in UI. Named imports only, never `import *`.
- **Use existing utilities** — ID generation via `packages/events/src/utils/ids.ts`, timestamps via `packages/events/src/utils/timestamps.ts`.

## Testing

New event generators must include:
- **Schema structure test** — required fields present, correct types, correct ID prefixes.
- **Enum validation test** — status values, decline codes, and other enums match Stripe's documented values.
- **Integration test** if part of a scenario — entity ID correlation across events in the sequence.

Schema accuracy bugs (our payload doesn't match Stripe's actual behavior) are treated as P0. When reporting schema bugs, include the event type, the field that's incorrect, and evidence from Stripe's documentation or a real Stripe event.

## Reporting Issues

Open a GitHub issue for bugs, incorrect event payloads, missing event types, or documentation errors. Include the Stripe API version you're testing against if relevant.

For security vulnerabilities in the hosted instance at lab.sutyr.com, email security@sutyr.com instead of opening a public issue.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0. See [LICENSE](LICENSE) for the full text. The CLA provides additional terms regarding how Sutyr Inc. may use contributions.