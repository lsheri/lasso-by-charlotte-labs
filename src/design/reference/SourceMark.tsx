import * as React from 'react';
import { ToolBadge } from './ToolBadge';
import { BrandLogo } from '@/components/connectors/BrandLogo';
import type { ToolId } from '@/lib/onboarding-tools';
import type { WorkSource } from './work-types';
import { SOURCE_LABEL } from './work-types';

/**
 * The tool mark on a sketch card and in the viewer bar.
 *
 * Three branches, because the eleven display sources do not all have the same
 * kind of mark available:
 *   BADGE_TOOL   the tool is in the onboarding picker, so ToolBadge owns its
 *                mark and its hue. Claude, ChatGPT, Granola, Gemini, Copilot.
 *   Google apps  Slides, Docs and Sheets are not in ToolBadge, so these are
 *                placeholder glyphs in the vendor's own hex, to be swapped for
 *                the simple-icons paths when ToolBadge gains them.
 *   neutral      Wispr has a BrandLogo mark but is not in the picker, so it
 *                gets the logo in a plain square. Perplexity and 'other' have
 *                no mark at all and get an empty square rather than an
 *                invented logo. One place decides, and nothing guesses.
 *
 * PORT DEVIATION, deliberate. The design system calls ToolBadge with
 * container="hairline". This app's ToolBadge has no container prop: the
 * 16 Oct decision recorded in its own header is that the soft tinted square
 * won. On a value disagreement the repo wins, so the prop is dropped.
 */

export type GoogleApp = 'slides' | 'docs' | 'sheets';

const GOOGLE_HEX: Record<GoogleApp, string> = {
  slides: '#F4B400',
  docs: '#4285F4',
  sheets: '#0F9D58',
};

/** Sources whose mark ToolBadge already owns. */
const BADGE_TOOL: Partial<Record<WorkSource, ToolId>> = {
  claude: 'claude',
  chatgpt: 'chatgpt',
  granola: 'granola',
  gemini: 'gemini',
  copilot: 'copilot',
};

const isGoogleApp = (s: WorkSource): s is GoogleApp => s === 'slides' || s === 'docs' || s === 'sheets';

export function GoogleGlyph({ app, size = 24 }: { app: GoogleApp; size?: number }) {
  const hex = GOOGLE_HEX[app];
  return (
    <svg role="img" aria-label={SOURCE_LABEL[app]} viewBox="0 0 24 24" width={size} height={size} className="inline-block shrink-0">
      <path d="M6 1.5h8.5l5 5V21a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 21V3A1.5 1.5 0 0 1 6 1.5z" fill={hex} />
      <path d="M14.5 1.5V5A1.5 1.5 0 0 0 16 6.5h3.5z" fill="#ffffff" fillOpacity={0.45} />
      {app === 'slides' ? <rect x="7.5" y="10.5" width="9" height="7" rx="0.8" fill="none" stroke="#ffffff" strokeWidth="1.6" /> : null}
      {app === 'docs' ? <path d="M8 11h8M8 14h8M8 17h5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" /> : null}
      {app === 'sheets' ? <path d="M7.5 10.5h9v7h-9zM7.5 14h9M11.5 10.5v7" fill="none" stroke="#ffffff" strokeWidth="1.5" /> : null}
    </svg>
  );
}

function NeutralSquare({ box, children }: { box: number; children?: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: box,
        height: box,
        borderRadius: 'var(--radius-md-new)',
        border: 'var(--border-weight) solid var(--line-hairline)',
        background: 'var(--surface-raised)',
      }}
    >
      {children}
    </span>
  );
}

export function SourceMark({ source, size = 'sm' }: { source: WorkSource; size?: 'sm' | 'md' }) {
  const tool = BADGE_TOOL[source];
  if (tool) return <ToolBadge tool={tool} size={size} />;

  const box = size === 'sm' ? 28 : 36;
  const glyph = size === 'sm' ? 16 : 20;

  if (isGoogleApp(source)) {
    return (
      <NeutralSquare box={box}>
        <GoogleGlyph app={source} size={glyph} />
      </NeutralSquare>
    );
  }

  if (source === 'wispr') {
    return (
      <NeutralSquare box={box}>
        <BrandLogo brand="wispr" size={glyph - 1} />
      </NeutralSquare>
    );
  }

  /* Perplexity and other. No mark exists, so none is invented. */
  return <NeutralSquare box={box} />;
}
