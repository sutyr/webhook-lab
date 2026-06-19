// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      {
        userAgent: [
          'ClaudeBot',
          'Claude-Web',
          'GPTBot',
          'OAI-SearchBot',
          'PerplexityBot',
          'Google-Extended',
          'Applebot-Extended',
        ],
        allow: '/',
      },
    ],
    sitemap: 'https://lab.sutyr.com/sitemap.xml',
    host: 'https://lab.sutyr.com',
  };
}
