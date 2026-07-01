// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@webhook-lab/events', '@webhook-lab/signatures'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' fonts.gstatic.com",
              "connect-src 'self'",
              "img-src 'self' data:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      {
        // The CBOM is extensionless JSON (CycloneDX); set the type explicitly.
        source: '/.well-known/cbom',
        headers: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
      },
      {
        // Keep every non-production host (preview deploys, *.vercel.app staging)
        // out of search indexes. Only the canonical production domain is indexable.
        source: '/(.*)',
        missing: [{ type: 'host', value: 'lab.sutyr.com' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
