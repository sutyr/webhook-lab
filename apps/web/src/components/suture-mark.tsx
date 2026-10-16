// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
// Sutyr identity, drawn from the brand kit (sutyr-website/brand, October 2026).
// The mark paths are exact; never modify them, close the seam, or recolour
// one half on its own. Colours come from --color-mark-* so both themes stay
// on the tonal-black scheme.

const MARK_TOP = 'M16 12L84 12L84 59.5L52.5 59.5L52.5 35.5L16 35.5Z';
const MARK_BOTTOM = 'M84 88L16 88L16 40.5L47.5 40.5L47.5 64.5L84 64.5Z';

// "sutyr" as outlines (Plex Mono Medium with the redrawn t, y and r), placed
// exactly as in sutyr-lockup-nav-*-transparent.svg.
const WORDMARK =
  'M122.495 68.496Q116.74 68.496 112.596 66.647Q108.451 64.797 105.916 61.714L110.506 57.604Q112.835 60.139 115.747 61.475Q118.658 62.811 122.632 62.811Q126.262 62.811 128.489 61.577Q130.715 60.344 130.715 57.741Q130.715 56.645 130.304 55.891Q129.893 55.138 129.14 54.658Q128.386 54.179 127.393 53.905Q126.399 53.631 125.303 53.494L119.686 52.603Q117.631 52.329 115.507 51.713Q113.383 51.096 111.705 49.966Q110.027 48.835 108.965 47.054Q107.903 45.273 107.903 42.533Q107.903 37.121 112.048 34.312Q116.192 31.504 122.974 31.504Q127.907 31.504 131.503 32.976Q135.1 34.449 137.497 37.052L133.318 41.437Q131.948 39.861 129.414 38.525Q126.879 37.189 122.7 37.189Q115.233 37.189 115.233 41.916Q115.233 44.177 116.843 45.033Q118.453 45.89 120.645 46.164L126.262 47.054Q128.386 47.397 130.476 47.945Q132.565 48.493 134.243 49.623Q135.922 50.754 136.984 52.535Q138.045 54.316 138.045 57.056Q138.045 62.399 133.901 65.448Q129.756 68.496 122.495 68.496ZM167.231 61.646L166.889 61.646Q166.341 63.016 165.485 64.283Q164.628 65.551 163.395 66.476Q162.162 67.4 160.518 67.948Q158.874 68.496 156.682 68.496Q151.338 68.496 148.05 65.003Q144.762 61.509 144.762 55.069L144.762 32.326L152.229 32.326L152.229 53.973Q152.229 62.399 159.559 62.399Q160.997 62.399 162.368 62.023Q163.738 61.646 164.834 60.892Q165.93 60.139 166.581 59.008Q167.231 57.878 167.231 56.303L167.231 32.326L174.699 32.326L174.699 67.674L167.231 67.674ZM189.019 67.674L204.159 67.674L204.159 61.646L196.486 61.646L196.486 38.354L204.159 38.354L204.159 32.326L196.486 32.326L196.486 19.858L189.019 19.858L189.019 32.326L180.182 32.326L180.182 38.354L189.019 38.354ZM235.811 32.326L243.347 32.326L223.411 81.376L210.258 81.376L210.258 75.347L218.616 75.347L221.836 67.195L207.587 32.326L215.396 32.326L221.014 47.123L225.398 59.248L225.809 59.248L230.193 47.123ZM248.008 67.674L255.475 67.674L255.475 39.45L271.779 39.45L271.779 32.326L248.008 32.326Z';

export function SutureMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <path d={MARK_TOP} fill="var(--color-mark-top)" />
      <path d={MARK_BOTTOM} fill="var(--color-mark-bottom)" />
    </svg>
  );
}

/** The site-nav lockup: 88 by 26 at 1x, whole-pixel box as the kit specifies. */
export function SutyrLockup({ className }: { className?: string }) {
  return (
    <svg
      viewBox="13.353 11.765 258.824 76.471"
      width={88}
      height={26}
      className={className}
      role="img"
      aria-label="Sutyr"
    >
      <path d={MARK_TOP} fill="var(--color-mark-top)" />
      <path d={MARK_BOTTOM} fill="var(--color-mark-bottom)" />
      <path d={WORDMARK} fill="var(--color-mark-top)" />
    </svg>
  );
}

/**
 * Sutyr lockup plus the product name. Below 640px the word drops and the mark
 * carries the identity alone (the kit's minimum lockup size is a 20px mark box).
 */
export function LabLockup() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <SutyrLockup className="hidden flex-shrink-0 sm:block" />
      <SutureMark size={24} className="flex-shrink-0 sm:hidden" />
      <span aria-hidden="true" className="hidden h-4 w-px flex-shrink-0 bg-border-strong sm:block" />
      <span className="truncate font-sans text-[0.875rem] font-medium tracking-[-0.01em] text-text-primary">
        Webhook Lab
      </span>
    </span>
  );
}
