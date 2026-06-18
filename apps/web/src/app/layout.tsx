// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { LabProvider } from '@/lib/lab-context';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  style: 'italic',
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Webhook Lab',
  description:
    'Open-source Stripe webhook testing tool. Generate structurally correct events, sign them, and fire at any endpoint.',
  metadataBase: new URL('https://lab.sutyr.com'),
  openGraph: {
    title: 'Webhook Lab',
    description:
      'Generate and test Stripe webhook events with proper signatures. No Stripe account required.',
    type: 'website',
    siteName: 'Webhook Lab by Sutyr',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Webhook Lab',
    description:
      'Generate and test Stripe webhook events with proper signatures. No Stripe account required.',
  },
};

export const viewport: Viewport = {
  // Extend under the notch/home-indicator so env(safe-area-inset-*) resolves.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF8F4' },
    { media: '(prefers-color-scheme: dark)', color: '#080604' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${instrumentSerif.variable} ${dmSans.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* FOUC prevention: set theme class synchronously before paint.
            Hardcoded constant — no user input. Safe for dangerouslySetInnerHTML. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('webhook-lab-theme')==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        <noscript>
          <style>{'.panel-animated { opacity: 1 !important; transform: none !important; }'}</style>
        </noscript>
      </head>
      <body>
        <ThemeProvider>
          <LabProvider>{children}</LabProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
