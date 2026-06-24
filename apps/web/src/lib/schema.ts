// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
//
// Cross-domain entity-consolidation JSON-LD.
//
// This is the RECIPROCAL half of the schema graph that sutyr.com emits.
// sutyr.com declares Webhook Lab as its product via a SoftwareApplication
// node whose `@id` is `https://lab.sutyr.com/#software`, and lists
// `https://lab.sutyr.com` in its Organization.sameAs. For Google to fuse
// the two domains into ONE brand entity (rather than ranking them as two
// competing listings), this site must name the SAME two `@id`s back:
//
//   - Organization  -> @id MUST be `https://sutyr.com/#organization`
//     (a reference to the parent, NOT a new org — sutyr.com holds the
//     full definition; we only restate the id so the graphs link)
//   - SoftwareApplication -> @id MUST be `https://lab.sutyr.com/#software`
//     (the exact id sutyr.com already points at)
//
// Do NOT mint a different Organization @id here and do NOT change the
// software @id: the two-sided id match IS the fusion mechanism. Changing
// either side silently breaks the consolidation.
//
// Matching contract documented in the sutyr-website repo at
// docs/webhook-lab-schema.md.

const SUTYR_ORG_ID = 'https://sutyr.com/#organization';
const LAB_SOFTWARE_ID = 'https://lab.sutyr.com/#software';

export const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': SUTYR_ORG_ID,
      name: 'Sutyr',
      url: 'https://sutyr.com',
      sameAs: ['https://github.com/sutyr', 'https://lab.sutyr.com'],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': LAB_SOFTWARE_ID,
      name: 'Webhook Lab',
      alternateName: 'Sutyr Webhook Lab',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cloud, Web-based',
      url: 'https://lab.sutyr.com',
      description:
        'Open-source Stripe webhook testing tool by Sutyr. Generate schema-accurate Stripe billing events, sign them with valid HMAC signatures, and fire them at any endpoint. Apache 2.0.',
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
      isAccessibleForFree: true,
      codeRepository: 'https://github.com/sutyr/webhook-lab',
      publisher: { '@id': SUTYR_ORG_ID },
      provider: { '@id': SUTYR_ORG_ID },
      creator: { '@id': SUTYR_ORG_ID },
    },
  ],
} as const;
