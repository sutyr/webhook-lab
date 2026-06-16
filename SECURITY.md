# Security Policy

Webhook Lab is an open-source Stripe webhook testing tool by Sutyr Inc. It
generates Stripe-shaped events, signs them, and fires them at an HTTP endpoint
you supply. Because the hosted instance proxies outbound requests on your
behalf, we take its security posture seriously and welcome responsible reports.

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report privately through either channel:

- **Email:** [security@sutyr.com](mailto:security@sutyr.com)
- **GitHub:** the repository's **Security → Report a vulnerability** (private advisory)

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Affected component (e.g. `packages/signatures`, `apps/web/src/lib/url-validator.ts`)
  and whether it affects the hosted instance (`lab.sutyr.com`), self-hosted
  deployments, or the published packages

We aim to acknowledge reports within **3 business days** and to provide a
remediation timeline after triage. We practice coordinated disclosure, please
give us a reasonable window to ship a fix before any public write-up, and we'll
credit you (if you wish) when the fix ships.

## Supported Versions

The latest release on the `main` branch receives security fixes. Webhook Lab is
pre-1.0; we do not backport fixes to older tags.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Y        |

## Security Model

Understanding what the tool does is key to scoping a report:

- **It is a server-side proxy.** The web app accepts a target URL, a payload,
  and a signing secret, signs the payload server-side, and makes the outbound
  request from the server to your endpoint. The request transits Sutyr
  infrastructure on the hosted instance; it is **not** sent directly from your
  browser.
- **It stores nothing.** Target URLs, payloads, signing secrets, and caller IPs
  are processed in memory for the duration of a request only. There is no
  database, and payloads and secrets are never logged or persisted.
- **It is unauthenticated by design.** There are no accounts; anyone can use it.
  Abuse protection is therefore rate/limit-based, not identity-based.
- **Self-hosted instances differ.** Setting `WEBHOOK_LAB_ALLOW_PRIVATE=true`
  intentionally disables SSRF protection so operators can fire at `localhost`
  and private networks. The hosted instance never sets this.

## Built-in Protections

These controls are implemented in-tree and are fair game for scrutiny:

| Control | Where |
| ------- | ----- |
| SSRF protection — blocks loopback, RFC 1918, link-local (169.254/16), carrier-grade NAT (100.64/10), cloud-metadata hosts, IPv6 loopback/ULA/link-local/IPv4-mapped, and non-HTTP schemes | `apps/web/src/lib/url-validator.ts` |
| No redirect following (`redirect: 'manual'`) so a validated URL cannot bounce to an internal target | `apps/web/src/app/api/fire/route.ts`, `fire-prepared/route.ts` |
| Stripe-compatible signing — HMAC-SHA256, secret used verbatim, constant-time comparison (`timingSafeEqual`), 300s timestamp tolerance | `packages/signatures/src` |
| Rate limiting — 60 requests/min per IP (the hosted instance adds edge enforcement) | `apps/web/src/lib/rate-limit.ts` |
| Request body limit (512 KB), Content-Type validation, malformed-JSON handling | `apps/web/src/lib/parse-body.ts` |
| Response read cap (1 MB) and outbound request timeout | `apps/web/src/app/api/fire/route.ts` |
| Security headers — CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` | `apps/web/next.config.ts` |
| Per-request correlation ID (`X-Webhook-Lab-Request-Id`) | `apps/web/src/app/api/fire/route.ts` |

## In Scope

- SSRF bypasses — any way to reach private, internal, or cloud-metadata
  addresses despite `url-validator.ts` (e.g. DNS rebinding, parser confusion,
  encoding tricks)
- Signature forgery or timing side-channels in `packages/signatures`
- XSS, CSP bypass, or clickjacking in the web UI
- Exposure, logging, or persistence of signing secrets, payloads, or target URLs
- Denial-of-service amplification materially beyond the documented limits
- Vulnerable dependencies with a demonstrable path to impact

## Out of Scope

- The tool sending requests to a **public** endpoint you supply — that is its
  purpose. Only reaching **private/internal** infrastructure is a vulnerability.
- Self-hosted instances running with `WEBHOOK_LAB_ALLOW_PRIVATE=true` (SSRF is
  intentionally disabled there)
- The in-memory rate limiter being "soft" on self-hosted deployments (the hosted
  instance enforces limits at the edge)
- The fact that fired payloads transit the server (documented proxy behavior)
- Absence of authentication (intentional — no accounts)
- Vulnerabilities in **your** webhook handler or your own infrastructure
- Best-practice or missing-header suggestions without demonstrable impact, and
  automated scanner output without a working proof of concept

## Disclosure

We will publish a GitHub Security Advisory for confirmed vulnerabilities once a
fix is available, crediting the reporter unless anonymity is requested.
