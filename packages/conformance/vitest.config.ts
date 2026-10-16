// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
  // Test against the sibling packages' source, so a stale dist never hides a change.
  resolve: {
    alias: {
      '@webhook-lab/events': path.resolve(__dirname, '../events/src/index.ts'),
      '@webhook-lab/signatures': path.resolve(__dirname, '../signatures/src/index.ts'),
    },
  },
});
