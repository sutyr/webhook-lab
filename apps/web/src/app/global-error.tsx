// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // This replaces the root layout, so it must be fully self-contained: its own
  // <html>/<body> and inline styles, since globals.css and the theme provider
  // are not guaranteed to be available when the root layout itself failed.
  // Dark surface (the app default), copper accent, hardcoded design tokens.
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          backgroundColor: '#0F0C08',
          color: '#FAF6F0',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <svg viewBox="0 0 100 100" width={28} height={28} aria-hidden="true">
          <path d="M16 12L84 12L84 59.5L52.5 59.5L52.5 35.5L16 35.5Z" fill="#E8EEF7" />
          <path d="M84 88L16 88L16 40.5L47.5 40.5L47.5 64.5L84 64.5Z" fill="#D49A3A" />
        </svg>
        <h1 style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}>Something went wrong</h1>
        <p
          style={{
            fontSize: '14px',
            color: '#CFC8BA',
            maxWidth: '28rem',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          The application failed to load. Reload the page, and if it keeps happening,
          the issue is on our side.
        </p>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#9E9588', margin: 0 }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '8px',
            border: 'none',
            borderRadius: '7px',
            backgroundColor: '#B8782A',
            color: '#ffffff',
            padding: '11px 16px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
