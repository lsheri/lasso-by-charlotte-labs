import * as React from 'react';
import { ToolBadge } from './ToolBadge';
import type { WorkSource } from './work-types';
import { SOURCE_LABEL } from './work-types';

/**
 * The tool mark on a sketch card and in the viewer bar. Claude, ChatGPT and
 * Granola reuse ToolBadge's marks. Google Slides, Docs and Sheets are not in
 * ToolBadge yet, so these are placeholder glyphs in the vendor's own hex,
 * to be swapped for the simple-icons paths when ToolBadge gains them.
 *
 * PORT DEVIATION, deliberate. The design system calls ToolBadge with
 * container="hairline". This app's ToolBadge has no container prop: the
 * 16 Oct decision recorded in its own header is that the soft tinted square
 * won, and a white square with a hairline lost. On a value disagreement the
 * repo wins, so the prop is dropped and the mark wears the tinted square.
 * The design system's SourceMark is the stale copy and gets corrected there.
 */

export type GoogleApp = 'slides' | 'docs' | 'sheets';

const GOOGLE_HEX: Record<GoogleApp, string> = {
  slides: '#F4B400',
  docs: '#4285F4',
  sheets: '#0F9D58',
};

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

export function SourceMark({ source, size = 'sm' }: { source: WorkSource; size?: 'sm' | 'md' }) {
  if (source === 'claude' || source === 'chatgpt' || source === 'granola') {
    return <ToolBadge tool={source} size={size} />;
  }
  const box = size === 'sm' ? 28 : 36;
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
      <GoogleGlyph app={source} size={size === 'sm' ? 16 : 20} />
    </span>
  );
}
