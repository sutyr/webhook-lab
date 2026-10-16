// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Webhook Lab by Sutyr',
    short_name: 'Webhook Lab',
    description:
      'Generate, sign, and fire Stripe webhook events at any endpoint. No Stripe account required.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
