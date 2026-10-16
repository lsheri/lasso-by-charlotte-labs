import * as React from 'react';
import { useState } from 'react';
import { Sketch } from './Sketch';
import type { SketchTone } from './Sketch';
import { ResizeHandle } from './ResizeHandle';
import { useCardResize } from './useCardResize';
import type { CardSize } from './useCardResize';
import { SourceMark } from './SourceMark';
import { KIND_LABEL, SOURCE_LABEL, kindOf, sketchLabel } from './work-types';
import type { Work } from './work-types';

export { SketchRow } from './SketchRow';
export type { SketchRowProps } from './SketchRow';

/**
 * SketchCard. Status: exploring (16 Oct 2026). The face for LISTS: All work
 * and All AI chats. On a board the same work shows as BoardCard, the real
 * preview. Not a replacement for WorkCard face G until a DESIGN-DECISIONS.md
 * row says so.
 *
 *   drawing   most of the card: a hand drawing of WHAT the work is
 *   mark      the tool's own logo, top left, at 1.2x. No stripe, no spine.
 *   strip     slim: tiny mono source and date, small serif title
 *
 * Click selects. Double click (or Enter) opens the real work in WorkViewer.
 */

export type SketchCardTier = 'compact' | 'regular' | 'expanded';
export type SketchCardSize = CardSize;

export type SketchCardProps = {
  work: Work;
  width?: number;
  /** Defaults to width x 1.25. */
  height?: number;
  /** bone: drawing on bone paper. ink: drawing on the inverse surface. */
  tone?: SketchTone;
  /** Adds a corner handle; drag or use arrow keys to resize. */
  resizable?: boolean;
  onResize?: (size: SketchCardSize) => void;
  /** Selected, or context on a board: acid outline. */
  inHand?: boolean;
  /** The spotlight: 30 percent when another card is in hand. */
  dimmed?: boolean;
  onSelect?: (work: Work) => void;
  /** Double click or Enter. */
  onOpen?: (work: Work) => void;
};

export const SKETCH_CARD_MIN: SketchCardSize = { width: 160, height: 200 };
export const SKETCH_CARD_MAX: SketchCardSize = { width: 560, height: 700 };

export function tierFor(width: number): SketchCardTier {
  if (width < 200) return 'compact';
  if (width < 340) return 'regular';
  return 'expanded';
}

const MONO = 'var(--font-mono)';

export const Lock = () => (
  <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="4" y="10.5" width="16" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

export function SketchCard({
  work,
  width = 220,
  height,
  tone = 'bone',
  resizable = false,
  onResize,
  inHand,
  dimmed,
  onSelect,
  onOpen,
}: SketchCardProps) {
  const { size, resizing, handleProps } = useCardResize(
    { width, height: height ?? Math.round(width * 1.25) },
    SKETCH_CARD_MIN,
    SKETCH_CARD_MAX,
    onResize,
  );
  const [hover, setHover] = useState(false);

  const um = !work.onBoard;
  const ink = tone === 'ink';
  const tier = tierFor(size.width);
  const kind = kindOf(work);
  const label = SOURCE_LABEL[work.source];
  const lifted = hover && !dimmed && !resizing;
  const titleSize = tier === 'compact' ? 11.5 : tier === 'regular' ? 12.5 : 14;
  /** Mark scaled up 1.2x from SourceMark sm (28px box becomes about 34px). */
  const markScale = 1.2;
  const markInset = 8;
  const drawTop = markInset + Math.round(28 * markScale) - 2;
  const sketchActive = hover && !dimmed && !resizing;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={inHand ?? false}
      aria-label={`${work.title}. ${KIND_LABEL[kind]} from ${label}.${um ? ' No board.' : ''} Double click to open.`}
      onClick={() => onSelect?.(work)}
      onDoubleClick={() => onOpen?.(work)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpen?.(work);
        } else if (e.key === ' ') {
          e.preventDefault();
          onSelect?.(work);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: size.width,
        height: size.height,
        overflow: 'hidden',
        cursor: 'pointer',
        border: `var(--border-weight) ${um ? 'dashed' : 'solid'} ${um ? 'var(--line-pencil)' : 'var(--line-strong)'}`,
        borderRadius: 'var(--radius-sm-new)',
        background: um ? 'var(--surface-page)' : 'var(--surface-raised)',
        boxShadow: um ? 'var(--shadow-flat)' : lifted ? 'var(--shadow-float)' : 'var(--shadow-card-new)',
        outline: inHand ? '2px solid var(--hand-live)' : undefined,
        outlineOffset: 2,
        opacity: dimmed ? 0.3 : 1,
        transform: lifted ? 'translateY(-1px)' : undefined,
        transition:
          'transform var(--dur-quick) var(--ease-standard), opacity var(--dur-quick) var(--ease-standard), box-shadow var(--dur-quick) var(--ease-standard)',
        userSelect: 'none',
      }}
    >
      {/* Drawing, everything above a slim strip */}
      <div
        style={{
          position: 'relative',
          flex: '1 1 0',
          minHeight: 0,
          background: ink ? 'var(--surface-inverse)' : 'var(--surface-sunk)',
          borderBottom: `var(--border-weight) solid ${ink ? 'var(--neutral-80)' : 'var(--line-hairline)'}`,
          filter: um ? 'saturate(.2) opacity(.8)' : 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: tier === 'compact' ? `${drawTop}px 6px 6px` : `${drawTop}px 8px 8px` }}>
          <Sketch kind={kind} tone={tone} detail={tier === 'expanded' ? 'expanded' : 'compact'} label={sketchLabel(work.title)} active={sketchActive} />
        </div>
        <div style={{ position: 'absolute', top: markInset, left: markInset, transform: `scale(${markScale})`, transformOrigin: 'top left', zIndex: 1 }}>
          <SourceMark source={work.source} size="sm" />
        </div>
        {tier !== 'compact' ? (
          <span
            style={{
              position: 'absolute',
              top: 18,
              right: 10,
              fontFamily: MONO,
              fontSize: 'var(--text-micro)',
              letterSpacing: 'var(--label-tracking)',
              textTransform: 'uppercase',
              color: ink ? 'var(--neutral-50)' : 'var(--text-muted)',
            }}
          >
            {KIND_LABEL[kind]}
          </span>
        ) : null}
        {resizing ? <SizeReadout text={`${tier} · ${size.width}×${size.height}`} /> : null}
      </div>

      {/* Strip, slim: meta line, title, and (expanded) one summary line */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: tier === 'expanded' ? 3 : 2,
          padding: tier === 'compact' ? '5px 8px 6px' : '6px 10px 8px',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: MONO,
              fontSize: 7.5,
              fontWeight: 500,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {label}
            {work.date ? ` · ${work.date}` : ''}
          </span>
          {um ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, fontFamily: MONO, fontSize: 7.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              <Lock />
              No board
            </span>
          ) : tier !== 'compact' && work.board ? (
            <span style={{ flexShrink: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 7.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              {work.board}
            </span>
          ) : null}
        </div>

        <p
          style={{
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: tier === 'expanded' ? 2 : 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontFamily: 'var(--font-display)',
            fontSize: titleSize,
            lineHeight: 1.25,
            color: 'var(--text-primary)',
          }}
        >
          {work.title}
        </p>

        {tier === 'expanded' && work.summary ? (
          <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-mini)', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
            {work.summary}
          </p>
        ) : null}

        {tier === 'expanded' && work.prov ? (
          <div
            style={{
              marginTop: 1,
              paddingTop: 4,
              borderTop: `var(--border-weight) ${um ? 'dashed' : 'solid'} ${um ? 'var(--state-no-board)' : 'var(--line-hairline)'}`,
              fontFamily: MONO,
              fontSize: 7.5,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: 'var(--line-pencil)',
            }}
          >
            {work.prov}
          </div>
        ) : null}
      </div>

      {resizable ? <ResizeHandle size={size} visible={hover || resizing} handlers={handleProps} /> : null}
    </article>
  );
}

export function SizeReadout({ text }: { text: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        padding: '2px 6px',
        fontFamily: MONO,
        fontSize: 'var(--text-micro)',
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        background: 'var(--surface-raised)',
        border: 'var(--border-weight) solid var(--line-hairline)',
        borderRadius: 'var(--radius-sm-new)',
        color: 'var(--text-secondary)',
        zIndex: 4,
      }}
    >
      {text}
    </span>
  );
}
