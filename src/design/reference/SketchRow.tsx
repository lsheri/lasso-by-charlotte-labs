import * as React from 'react';
import { Sketch } from './Sketch';
import { SourceMark } from './SourceMark';
import { KIND_LABEL, SOURCE_LABEL, kindOf, sketchLabel } from './work-types';
import type { Work } from './work-types';

/**
 * SketchRow. Status: exploring. The same drawing as SketchCard, as a row for
 * All AI chats: the work a conversation produced, listed under it. A small
 * stack of paper carries the drawing; the tool mark sits on its corner.
 * Double click the row, or press Open, to see the real work.
 */

export type SketchRowProps = {
  work: Work;
  onOpen?: (work: Work) => void;
};

const Lock = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="4" y="10.5" width="16" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

export function SketchRow({ work, onOpen }: SketchRowProps) {
  const kind = kindOf(work);
  const label = SOURCE_LABEL[work.source];
  const um = !work.onBoard;
  const open = () => onOpen?.(work);
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onDoubleClick={open}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group flex w-full items-center gap-4 overflow-hidden pr-4 transition-colors hover:bg-[color:var(--surface-sunk)]"
      style={{
        height: 92,
        border: `var(--border-weight) ${um ? 'dashed' : 'solid'} ${um ? 'var(--line-pencil)' : 'var(--line-hairline)'}`,
        borderRadius: 'var(--radius-md-new)',
        background: um ? 'var(--surface-page)' : 'var(--surface-raised)',
      }}
    >
      {/* Paper stack, cropped by the row's bottom edge like a pocket */}
      <div aria-hidden className="relative h-full shrink-0" style={{ width: 120 }}>
        <span
          className="absolute transition-transform duration-200 group-hover:-rotate-6"
          style={{ left: 18, top: 16, width: 84, height: 96, background: 'var(--surface-sunk-2)', border: 'var(--border-weight) solid var(--line-pencil)', borderRadius: 'var(--radius-md-new)', transform: 'rotate(-4deg)' }}
        />
        <span
          className="absolute overflow-hidden transition-transform duration-200 group-hover:-translate-y-1"
          style={{ left: 24, top: 12, width: 84, height: 100, background: 'var(--surface-sunk)', border: 'var(--border-weight) solid var(--line-strong)', borderRadius: 'var(--radius-md-new)', filter: um ? 'saturate(.2)' : 'none' }}
        >
          <span className="absolute" style={{ inset: '8px 5px 24px' }}>
            <Sketch kind={kind} tone="bone" detail="compact" label={sketchLabel(work.title)} active={hover} />
          </span>
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {work.title}
        </p>
        <p className="m-0 mt-1 flex min-w-0 items-center gap-1.5" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <SourceMark source={work.source} size="sm" />
          <span className="truncate">
            {label} {KIND_LABEL[kind]}
          </span>
          <span aria-hidden>·</span>
          {um ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Lock />
              No board
            </span>
          ) : (
            <span className="truncate">{work.board}</span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={open}
        aria-label={`Open ${work.title}`}
        className="shrink-0 px-3 py-1.5 transition-transform active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          border: '1.5px solid var(--line-strong)',
          borderRadius: 'var(--radius-md-new)',
          background: 'transparent',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        Open
      </button>
    </div>
  );
}
