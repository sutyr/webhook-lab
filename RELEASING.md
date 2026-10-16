# Releasing

`@sutyr/webhook-lab` is the only published package. It bundles the workspace packages (`@webhook-lab/events`, `@webhook-lab/signatures`, `@webhook-lab/conformance`) into `dist/` with no runtime dependencies, and ships the `webhook-lab` CLI.

Every publish, local or CI, runs the same gate first: build the workspace packages, build the npm package, run every test, then `scripts/smoke-test-package.mjs`, which installs the packed tarball into an empty project and uses the CLI, the library and the type declarations the way a user would. `prepublishOnly` enforces this for local publishes.

## First publish (one time, from a terminal)

npm trusted publishing is configured from a package's settings page, so the first version has to exist before CI can publish.

1. Sign in at npmjs.com with 2FA turned on, and create the free organization **sutyr** (Add organization, unlimited public packages). The `@sutyr` scope belongs to it.
2. From a clean checkout of `main`:
   ```sh
   pnpm install
   npm login
   npm publish
   ```
   `prepublishOnly` runs the full gate (about two minutes), then npm asks for your 2FA code. `publishConfig.access` is already `public`.
3. Check it: `npx @sutyr/webhook-lab@latest --version` prints the version, and https://www.npmjs.com/package/@sutyr/webhook-lab shows the README.
4. Tag the release: `git tag v0.2.0 && git push origin v0.2.0`. The Release workflow runs the gate and skips publishing, because 0.2.0 is already on npm; the tag marks the commit.

## Turn on trusted publishing (one time, after the first publish)

On https://www.npmjs.com/package/@sutyr/webhook-lab/access, under **Trusted Publisher**, choose GitHub Actions and enter:

| Field | Value |
| --- | --- |
| Organization or user | `sutyr` |
| Repository | `webhook-lab` |
| Workflow filename | `release.yml` |
| Environment | `npm` |

Or from a terminal: `npm trust github @sutyr/webhook-lab --file release.yml --repo sutyr/webhook-lab --env npm`.

Then, under **Publishing access**, choose "Require two-factor authentication and disallow tokens". From here on no npm token exists anywhere: CI publishes through OIDC, and every version carries a provenance attestation linking it to the exact workflow run that built it.

Optionally, in the GitHub repository settings under Environments, give `npm` a required reviewer so a pushed tag waits for approval before publishing.

## Every later release

1. Bump `version` in the root `package.json` (and the workspace `package.json` files and `apps/web/src/app/api/health/route.ts`, which report it).
2. Add a dated section to `CHANGELOG.md`.
3. Commit, then tag and push:
   ```sh
   git tag v0.2.1 && git push origin main v0.2.1
   ```
4. The Release workflow checks the tag matches `package.json`, runs the gate and publishes with provenance.

Versions follow [Semantic Versioning](https://semver.org/). Until 1.0.0, a minor bump (0.3.0) may change check verdicts or generator output; a patch bump (0.2.1) must not.
