// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: { resolve: true },
  clean: true,
  target: 'node22',
  tsconfig: 'tsconfig.pub.json',
  noExternal: ['@webhook-lab/events', '@webhook-lab/signatures'],
});
