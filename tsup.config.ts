// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const root = path.dirname(fileURLToPath(import.meta.url));

// The workspace packages are private, so they are bundled into the published
// package from source. tsconfig.pub.json maps events and signatures; the
// conformance package is mapped here, for both the bundle and the types.
const WORKSPACE_PACKAGES = ['@webhook-lab/events', '@webhook-lab/signatures', '@webhook-lab/conformance'];
const SOURCE_PATHS = {
  '@webhook-lab/events': ['./packages/events/src/index.ts'],
  '@webhook-lab/signatures': ['./packages/signatures/src/index.ts'],
  '@webhook-lab/conformance': ['./packages/conformance/src/index.ts'],
};

const shared = {
  format: ['esm' as const],
  target: 'node22',
  tsconfig: 'tsconfig.pub.json',
  noExternal: WORKSPACE_PACKAGES,
  esbuildOptions(options: { alias?: Record<string, string> }) {
    options.alias = {
      ...options.alias,
      '@webhook-lab/conformance': path.join(root, 'packages/conformance/src/index.ts'),
    };
  },
};

export default defineConfig([
  // Library: dist/index.js and dist/index.d.ts.
  {
    ...shared,
    entry: ['src/index.ts'],
    dts: { resolve: true, compilerOptions: { paths: SOURCE_PATHS } },
    // Both configs build in parallel into dist; leave the CLI's output alone.
    clean: ['!cli.js', '!cli.js.map'],
  },
  // CLI: dist/cli.js, self-contained, with a node shebang.
  {
    ...shared,
    entry: ['src/cli.ts'],
    splitting: false,
    banner: { js: '#!/usr/bin/env node' },
  },
]);
