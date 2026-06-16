// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@webhook-lab/events': path.resolve(__dirname, 'packages/events/src/index.ts'),
      '@webhook-lab/signatures': path.resolve(__dirname, 'packages/signatures/src/index.ts'),
    },
  },
});
