// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          page: 'var(--color-surface-page)',
          card: 'var(--color-surface-card)',
          input: 'var(--color-surface-input)',
          elevated: 'var(--color-surface-elevated)',
          hover: 'var(--color-surface-hover)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          medium: 'var(--color-border-medium)',
          strong: 'var(--color-border-strong)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          muted: 'var(--color-text-muted)',
        },
        copper: {
          DEFAULT: 'var(--color-copper)',
          body: 'var(--color-copper-body)',
          glass: 'var(--color-copper-glass)',
        },
        state: {
          success: 'var(--color-state-success)',
          error: 'var(--color-state-error)',
          warning: 'var(--color-state-warning)',
          info: 'var(--color-state-info)',
        },
      },
      fontFamily: {
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      borderRadius: {
        cta: '7px',
        card: '6px',
        input: '5px',
        badge: '4px',
      },
    },
  },
  plugins: [],
};

export default config;
