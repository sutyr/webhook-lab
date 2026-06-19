// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = '2026-06-19';
  return [
    { url: 'https://lab.sutyr.com', lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: 'https://lab.sutyr.com/legal', lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
