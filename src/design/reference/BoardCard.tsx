import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { RealPreview, AUTHOR_WIDTH } from './RealPreview';
import { ResizeHandle } from './ResizeHandle';
import { useCardResize } from './useCardResize';
import type { CardSize } from './useCardResize';
import { Lock, SizeReadout } from './SketchCard';
import { SourceMark } from './SourceMark';
import { KIND_LABEL, SOURCE_LABEL, kindOf } from './work-types';
import type { Work } from './work-types';

/**
 * BoardCard. Status: exploring (16 Oct 2026). The face for a BOARD canvas:
 * the real work, scaled, not a drawing. Lists (All work, All AI chats) use
 * SketchCard. No source stripe: the tool mark says where it came from.
 *
 *   head      tool mark, title (one line), date
 *   preview   the real work, authored at 480 wide; dragging the card larger
 *             scales it up and reveals more of it
 *   foot      mono provenance, board; dashed with "No board" off board
 *
 * Click selects. Double click (or Enter) opens it in WorkViewer.
 *
 * `previewFallback` is a port deviation; see RealPreview's header.
 */

export type BoardCardProps = {
  work: Work;
  width?: number;
  /** Defaults to width x 0.85, the board's 260 by 220 proportion. */
  height?: number;
  resizable?: boolean;
  onResize?: (size: CardSize) => void;
  inHand?: boolean;
  dimmed?: boolean;
  onSelect?: (work: Work) => void;
  onOpen?: (work: Work) => void;
  /** Rendered instead of the empty state when the work has no content. */
  previewFallback?: React.ReactNode;
  actions?: React.ReactNode;
  headerInsetRight?: number;
  provenance?: React.ReactNode;
};

export const BOARD_CARD_MIN: CardSize = { width: 200, height: 170 };
export const BOARD_CARD_MAX: CardSize = { width: 720, height: 760 };

const MONO = 'var(--font-mono)';
const micro: React.CSSProperties = { fontFamily: MONO, fontSize: 8, letterSpacing: '.05em', textTransform: 'uppercase' };

export function BoardCard({ work, width = 260, height, resizable = false, onResize, inHand, dimmed, onSelect, onOpen, previewFallback, actions, headerInsetRight = 0, provenance }: BoardCardProps) {
  const { size, resizing, handleProps } = useCardResize(
    { width, height: height ?? Math.round(width * 0.85) },
    BOARD_CARD_MIN,
    BOARD_CARD_MAX,
    onResize,
  );
  const [hover, setHover] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: width, h: 140 });

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      setBox({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const um = !work.onBoard;
  const label = SOURCE_LABEL[work.source];
  const kind = kindOf(work);
  const scale = box.w / AUTHOR_WIDTH;
  const lifted = hover && !dimmed && !resizing;
  const interactive = Boolean(onSelect || onOpen);

  return (
    <article
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? inHand ?? false : undefined}
      aria-label={`${work.title}. ${KIND_LABEL[kind]} from ${label}.${um ? ' No board.' : ''} Double click to open.`}
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(work); } : undefined}
      onDoubleClick={onOpen ? (e) => { e.stopPropagation(); onOpen(work); } : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (onOpen) e.stopPropagation();
          onOpen?.(work);
        } else if (e.key === ' ') {
          e.preventDefault();
          if (onSelect) e.stopPropagation();
          onSelect?.(work);
        }
      } : undefined}
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
        cursor: interactive ? 'pointer' : 'inherit',
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
      <header className="flex shrink-0 items-center gap-2" style={{ height: 40, padding: `0 ${8 + headerInsetRight}px 0 6px`, borderBottom: 'var(--border-weight) solid var(--line-hairline)' }}>
        <SourceMark source={work.source} size="sm" />
        <span className="min-w-0 flex-1 truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
          {work.title}
        </span>
        {work.date ? <span style={{ ...micro, flexShrink: 0, color: 'var(--text-muted)' }}>{work.date}</span> : null}
      </header>

      <div ref={area} aria-hidden className="relative min-h-0 flex-1 overflow-hidden" style={{ filter: um ? 'saturate(.2) opacity(.8)' : 'none' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: AUTHOR_WIDTH, height: box.h / scale, transform: `scale(${scale})`, transformOrigin: '0 0', overflow: 'hidden', pointerEvents: 'none' }}>
          <RealPreview work={work} fallback={previewFallback} />
        </div>
        {resizing ? <SizeReadout text={`${size.width}×${size.height}`} /> : null}
      </div>

      <footer
        className="flex shrink-0 items-center gap-2"
        style={{ height: 26, padding: '0 10px', borderTop: `var(--border-weight) ${um ? 'dashed' : 'solid'} ${um ? 'var(--state-no-board)' : 'var(--line-hairline)'}` }}
      >
        {um ? (
          <span className="inline-flex items-center gap-1" style={{ ...micro, color: 'var(--text-secondary)' }}>
            <Lock />
            No board
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate" style={{ ...micro, color: 'var(--line-pencil)' }}>{provenance !== undefined ? provenance : work.prov ?? ''}</span>
        {!um && work.board ? <span className="truncate" style={{ ...micro, maxWidth: '50%', color: 'var(--text-secondary)' }}>{work.board}</span> : null}
        {actions ? <span style={{ flexShrink: 0 }}>{actions}</span> : null}
      </footer>

      {resizable ? <ResizeHandle size={size} visible={hover || resizing} handlers={handleProps} /> : null}
    </article>
  );
}