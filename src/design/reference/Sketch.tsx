import * as React from 'react';
import type { WorkKind } from './work-types';

/**
 * The drawing on a sketch card. Lasso's own hand: ink outlines, pencil
 * scribbles for text, one acid mark (a highlighter swipe, a selected cell,
 * the current slide). Never a screenshot, never real content beyond the two
 * handwritten words. A light displacement filter gives every stroke a wobble.
 *
 * Authored in a 240 x 180 box, then cropped tight to each drawing's own
 * bounds (VIEW below) so it fills the card instead of floating in margin.
 * `expanded` adds detail when the card is dragged large on a canvas.
 *
 * `active` (hover) plays one small motion per kind, each showing what the
 * work does: deck fans, doc gets highlighted, chat writes its reply, sheet
 * moves the selected cell, call plays.
 */

export type SketchTone = 'bone' | 'ink';
export type SketchDetail = 'compact' | 'expanded';

type Pal = { ink: string; pencil: string; paper: string; sunk: string; acid: string };

const PAL: Record<SketchTone, Pal> = {
  bone: {
    ink: 'var(--text-primary)',
    pencil: 'var(--line-pencil)',
    paper: 'var(--surface-raised)',
    sunk: 'var(--surface-sunk-2)',
    acid: 'var(--hand-live)',
  },
  ink: {
    ink: 'var(--text-on-inverse)',
    pencil: 'var(--neutral-50)',
    paper: 'var(--neutral-80)',
    sunk: 'var(--neutral-60)',
    acid: 'var(--hand-live)',
  },
};

/** Tight crop per drawing, in the 240 x 180 authoring space. */
const VIEW: Record<WorkKind, Record<SketchDetail, string>> = {
  deck: { compact: '48 20 156 106', expanded: '46 2 160 146' },
  doc: { compact: '68 12 104 78', expanded: '56 8 156 160' },
  chat: { compact: '28 22 184 124', expanded: '28 8 184 170' },
  sheet: { compact: '28 18 184 138', expanded: '28 8 184 160' },
  transcript: { compact: '30 6 168 154', expanded: '30 6 168 170' },
  email: { compact: '68 12 104 84', expanded: '56 8 156 160' },
};

export const KIND_ASPECT = Object.fromEntries(
  Object.entries(VIEW).map(([kind, views]) => [kind, Object.fromEntries(
    Object.entries(views).map(([detail, view]) => {
      const [, , width, height] = view.split(/\s+/).map(Number);
      if (width === undefined || height === undefined || height === 0) throw new Error('Invalid sketch viewBox');
      return [detail, width / height];
    }),
  )]),
) as Record<WorkKind, Record<SketchDetail, number>>;

type P = { p: Pal; ex: boolean; label: string; on: boolean };

const ln = (c: string, w = 1.4): React.CSSProperties => ({
  stroke: c,
  strokeWidth: w,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});
const sh = (c: string, fill: string, w = 1.4): React.CSSProperties => ({ ...ln(c, w), fill });
const hand = (c: string, size: number): React.CSSProperties => ({ fontFamily: 'var(--font-hand)', fontSize: size, fill: c });

/** Advance widths of the sketch label font, in font units, for U+0020 to U+007E
 * in code point order. Read from
 * node_modules/@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff
 * (hmtx table via the best cmap), unitsPerEm 1024. Changing the sketch label
 * font (--font-hand) requires regenerating this table and the two constants
 * below from the new font file, for example with Python fontTools:
 *   f = TTFont(path); cm = f.getBestCmap(); hm = f['hmtx']
 *   [hm[cm[c]][0] for c in range(32, 127)], hm[cm[0x2026]][0], f['head'].unitsPerEm */
export const HAND_FONT_UNITS_PER_EM = 1024;
export const HAND_ASCII_ADVANCE_UNITS: readonly number[] = [
  410,138,242,653,570,531,686,166,305,360,520,537,182,318,144,466,646,131,586,521,697,725,642,630,664,583,171,127,487,504,483,518,
  1068,656,728,725,664,606,709,709,620,155,542,620,709,847,642,686,653,730,730,658,638,575,642,963,614,547,803,435,514,554,314,703,
  176,521,575,648,525,554,608,528,507,155,182,629,161,797,512,576,570,526,565,514,414,520,531,828,482,562,507,361,149,490,455,
];
/** Advance of the ellipsis glyph in the same font, in font units. */
export const HAND_ELLIPSIS_ADVANCE_UNITS = 433;
/** Widest advance in the same font (1239 units). Used for any character outside
 * the table so an unknown glyph is never under-measured. */
export const HAND_CHARACTER_ADVANCE_EM = 1239 / HAND_FONT_UNITS_PER_EM;

/** Rendered width of a label in viewBox units at the given font size. */
export function handTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of Array.from(text)) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\u2026') em += HAND_ELLIPSIS_ADVANCE_UNITS / HAND_FONT_UNITS_PER_EM;
    else if (code >= 32 && code <= 126) em += (HAND_ASCII_ADVANCE_UNITS[code - 32] ?? 1239) / HAND_FONT_UNITS_PER_EM;
    else em += HAND_CHARACTER_ADVANCE_EM;
  }
  return em * fontSize;
}

/** Right edge of a kind's visible crop, read from its VIEW string. */
function viewRight(kind: WorkKind, detail: SketchDetail): number {
  const [x = 0, , w = 0] = VIEW[kind][detail].split(/\s+/).map(Number);
  return x + w;
}

/** The label's room: from its x to whichever is nearer, the page edge or the crop edge. */
function labelRoom(kind: WorkKind, ex: boolean, labelX: number, pageRight: number): number {
  return Math.min(pageRight, viewRight(kind, ex ? 'expanded' : 'compact')) - labelX;
}

/** Cuts only when the measured label is wider than its room. */
function pageLabel(label: string, availableWidth: number, fontSize: number): string {
  if (handTextWidth(label, fontSize) <= availableWidth) return label;
  const characters = Array.from(label);
  for (let n = characters.length - 1; n > 0; n--) {
    const cut = `${characters.slice(0, n).join('').trimEnd()}\u2026`;
    if (handTextWidth(cut, fontSize) <= availableWidth) return cut;
  }
  return '';
}

/** Springy state transform, held while hovered. */
const move = (on: boolean, t: string, origin = 'center', delay = 0): React.CSSProperties => ({
  transformBox: 'fill-box',
  transformOrigin: origin,
  transform: on ? t : 'none',
  transition: `transform var(--dur-base) var(--ease-spring) ${delay}ms`,
});
/** Keyframe that runs from the start each time hover begins. */
const play = (on: boolean, anim: string, origin = 'center'): React.CSSProperties => ({
  transformBox: 'fill-box',
  transformOrigin: origin,
  animation: on ? anim : 'none',
});
/** A scribble that writes itself in. Needs pathLength={1}. */
const write = (on: boolean, delay: number): React.CSSProperties => ({
  strokeDasharray: 1,
  strokeDashoffset: 0,
  animation: on ? `lasso-sk-write 420ms var(--ease-standard) ${delay}ms both` : 'none',
});

function scribble(x: number, y: number, w: number, amp = 1.6): string {
  const step = 6;
  const n = Math.max(1, Math.round(w / step));
  let d = `M${x} ${y} q${step / 2} ${-amp} ${step} 0`;
  for (let i = 1; i < n; i++) d += ` t${step} 0`;
  return d;
}

/** Hover: the slides fan out and the bars grow. */
function Deck({ p, ex, label, on }: P) {
  const y = ex ? 22 : 40;
  const pageX = 54;
  const pageWidth = 124;
  const labelX = pageX + 10;
  const labelFontSize = 12;
  return (
    <g>
      <rect x={74} y={y - 14} width={124} height={80} rx={2} style={{ ...sh(p.ink, p.paper, 1.2), ...move(on, 'translate(6px,-4px) rotate(5deg)', 'left bottom') }} />
      <rect x={64} y={y - 7} width={124} height={80} rx={2} style={{ ...sh(p.ink, p.paper, 1.2), ...move(on, 'translate(3px,-2px) rotate(2.5deg)', 'left bottom', 30) }} />
      <g style={move(on, 'rotate(-2deg) translateY(-2px)', 'center', 60)}>
        <rect x={pageX} y={y} width={pageWidth} height={80} rx={2} style={sh(p.ink, p.paper, 1.6)} />
        <path d={`M63 ${y + 23} q24 -3 50 -1`} style={ln(p.acid, 5)} />
        <text x={labelX} y={y + 20} style={hand(p.ink, labelFontSize)}>{pageLabel(label, labelRoom('deck', ex, labelX, pageX + pageWidth), labelFontSize)}</text>
        <path d={scribble(64, y + 40, 54)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(64, y + 50, 42)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(64, y + 60, 48)} style={ln(p.pencil, 1.2)} />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${142 + i * 10} ${y + 68} v-${12 + i * 9}`}
            style={{ ...ln(p.ink, 5), ...play(on, `lasso-sk-grow 520ms var(--ease-spring) ${120 + i * 90}ms both`, 'bottom') }}
          />
        ))}
        <path d={`M136 ${y + 71} h32`} style={ln(p.ink, 1.2)} />
      </g>
      {ex ? (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={54 + i * 32} y={y + 98} width={27} height={16} rx={1.5} style={sh(i === 0 ? p.ink : p.pencil, p.paper, i === 0 ? 1.6 : 1.2)} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <path key={`s${i}`} d={scribble(58 + i * 32, y + 106, 14, 1)} style={ln(p.pencil, 1)} />
          ))}
          <path d={`M55 ${y + 121} h25`} style={{ ...ln(p.acid, 3), ...move(on, 'translateX(32px)') }} />
        </g>
      ) : null}
    </g>
  );
}

/** Hover: the page lifts and the highlighter swipes across again. */
function Doc({ p, ex, label, on }: P) {
  const x = ex ? 62 : 74;
  const y = 18;
  const pageBodyWidth = 74;
  const foldWidth = 18;
  const pageWidth = pageBodyWidth + foldWidth;
  const labelX = x + 10;
  const labelFontSize = 11;
  return (
    <g>
      {ex ? (
        <path d={`M${x + 20} ${y + 6} h74 l18 18 v120 h-92 z`} transform={`rotate(5 ${x + 66} ${y + 80})`} style={sh(p.pencil, p.paper, 1.2)} />
      ) : null}
      <g style={move(on, 'rotate(-2.5deg) translateY(-3px)', 'center bottom')}>
        <path d={`M${x} ${y} h${pageBodyWidth} l${foldWidth} ${foldWidth} v126 h-${pageWidth} z`} style={sh(p.ink, p.paper, 1.6)} />
        <path d={`M${x + 74} ${y} v18 h18`} style={{ ...ln(p.ink, 1.2), ...move(on, 'translate(-2px,2px)', 'left bottom', 80) }} />
        <text x={labelX} y={y + 28} style={hand(p.ink, labelFontSize)}>{pageLabel(label, labelRoom('doc', ex, labelX, x + pageWidth), labelFontSize)}</text>
        <path d={scribble(x + 10, y + 44, 66)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 52, 70)} style={ln(p.pencil, 1.2)} />
        <rect x={x + 8} y={y + 56} width={58} height={8} rx={1} style={{ fill: p.acid, ...play(on, 'lasso-sk-swipe 460ms var(--ease-standard) 80ms both', 'left') }} />
        <path d={scribble(x + 10, y + 60, 54)} style={ln(p.ink, 1.2)} />
        <path d={scribble(x + 10, y + 68, 68)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 84, 72)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 92, 60)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 100, 66)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 116, 40)} style={ln(p.pencil, 1.2)} />
      </g>
      {ex ? (
        <g>
          <path d={`M${x + 70} ${y + 60} q34 -2 50 -24`} style={ln(p.ink, 1.2)} />
          <path d={`M${x + 114} ${y + 38} l6 -3 l1 7`} style={ln(p.ink, 1.2)} />
          <circle cx={x + 132} cy={y + 26} r={9} style={ln(p.ink, 1.2)} />
          <text x={x + 128.5} y={y + 30.5} style={hand(p.ink, 12)}>?</text>
        </g>
      ) : null}
    </g>
  );
}

/** Hover: the page lifts and the addressed rows write themselves in, top down. */
function Email({ p, ex, label, on }: P) {
  const x = ex ? 62 : 74;
  const y = 18;
  const pageBodyWidth = 74;
  const foldWidth = 18;
  const pageWidth = pageBodyWidth + foldWidth;
  const labelX = x + 10;
  const labelFontSize = 11;
  return (
    <g>
      {ex ? (
        <path d={`M${x + 20} ${y + 6} h74 l18 18 v120 h-92 z`} transform={`rotate(5 ${x + 66} ${y + 80})`} style={sh(p.pencil, p.paper, 1.2)} />
      ) : null}
      <g style={move(on, 'rotate(-2.5deg) translateY(-3px)', 'center bottom')}>
        <path d={`M${x} ${y} h${pageBodyWidth} l${foldWidth} ${foldWidth} v126 h-${pageWidth} z`} style={sh(p.ink, p.paper, 1.6)} />
        <path d={`M${x + 74} ${y} v18 h18`} style={{ ...ln(p.ink, 1.2), ...move(on, 'translate(-2px,2px)', 'left bottom', 80) }} />
        {[0, 1].map((i) => (
          <g key={i}>
            <path d={`M${x + 10} ${y + 14 + i * 11} h11`} pathLength={1} style={{ ...ln(p.ink, 1.2), ...write(on, 60 + i * 90) }} />
            <path d={scribble(x + 26, y + 14 + i * 11, 36)} pathLength={1} style={{ ...ln(p.pencil, 1.2), ...write(on, 100 + i * 90) }} />
          </g>
        ))}
        <path d={`M${x + 8} ${y + 32} h${pageWidth - 16}`} style={ln(p.pencil, 1.2)} />
        <rect x={x + 8} y={y + 41} width={58} height={8} rx={1} style={{ fill: p.acid, ...play(on, 'lasso-sk-swipe 460ms var(--ease-standard) 240ms both', 'left') }} />
        <text x={labelX} y={y + 48} style={hand(p.ink, labelFontSize)}>{pageLabel(label, labelRoom('email', ex, labelX, x + pageWidth), labelFontSize)}</text>
        <path d={scribble(x + 10, y + 70, 70)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 78, 64)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 86, 72)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 102, 66)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 110, 58)} style={ln(p.pencil, 1.2)} />
        <path d={scribble(x + 10, y + 118, 44)} style={ln(p.pencil, 1.2)} />
      </g>
      {ex ? (
        <g>
          <path d={`M${x + 70} ${y + 24} q34 -4 48 -14`} style={ln(p.ink, 1.2)} />
          <path d={`M${x + 112} ${y + 8} l7 2 l-3 6`} style={ln(p.ink, 1.2)} />
        </g>
      ) : null}
    </g>
  );
}

/** Hover: the question nudges in and the reply writes itself line by line. */
function Chat({ p, ex, on }: P) {
  const y = ex ? 14 : 28;
  const bh = ex ? 56 : 62;
  const lines = ex ? [106, 96, 104] : [106, 96, 104, 60];
  return (
    <g>
      <g style={move(on, 'translate(-4px,-2px)')}>
        <rect x={112} y={y} width={94} height={28} rx={12} style={sh(p.ink, p.sunk, 1.3)} />
        <path d={scribble(124, y + 14, 68)} style={ln(p.ink, 1.2)} />
      </g>
      <g style={move(on, 'translateY(-2px)', 'left bottom', 60)}>
        <rect x={34} y={y + 42} width={136} height={bh} rx={12} style={sh(p.ink, p.paper, 1.6)} />
        <path d={`M46 ${y + 42 + bh} l-8 9 l16 -8`} style={sh(p.ink, p.paper, 1.4)} />
        {lines.map((w, i) => (
          <path key={i} d={scribble(48, y + 58 + i * 10, w)} pathLength={1} style={{ ...ln(p.pencil, 1.2), ...write(on, 140 + i * 160) }} />
        ))}
      </g>
      {ex ? (
        <g>
          <rect x={120} y={y + 112} width={86} height={24} rx={11} style={sh(p.ink, p.sunk, 1.3)} />
          <path d={scribble(130, y + 124, 62)} style={ln(p.ink, 1.2)} />
          <rect x={34} y={y + 146} width={172} height={16} rx={8} style={sh(p.pencil, p.paper, 1.2)} />
          <path d={`M46 ${y + 150} v8`} style={{ ...ln(p.ink, 1.4), ...play(on, 'lasso-sk-blink 900ms steps(1) infinite') }} />
          <circle cx={197} cy={y + 154} r={4.5} style={{ fill: p.ink }} />
        </g>
      ) : null}
    </g>
  );
}

/** Hover: the selected cell hops to its neighbour, the header fills. */
function Sheet({ p, ex, on }: P) {
  const x = 34;
  const y = ex ? 14 : 24;
  const cols = 4;
  const cw = 43;
  const rows = ex ? 6 : 7;
  const rh = ex ? 15 : 18;
  const w = cols * cw;
  const h = rows * rh;
  const lens = [26, 18, 22, 14];
  return (
    <g>
      <rect x={x} y={y} width={w} height={rh} style={{ fill: p.sunk }} />
      <rect x={x} y={y} width={w} height={h} rx={1.5} style={sh(p.ink, 'none', 1.6)} />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <path key={`c${i}`} d={`M${x + (i + 1) * cw} ${y} v${h}`} style={ln(p.pencil, 1)} />
      ))}
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <path key={`r${i}`} d={`M${x} ${y + (i + 1) * rh} h${w}`} style={ln(p.pencil, 1)} />
      ))}
      {Array.from({ length: cols }).map((_, c) => (
        <path key={`h${c}`} d={scribble(x + c * cw + 7, y + rh / 2 + 1, 22, 1.2)} style={ln(p.ink, 1.3)} />
      ))}
      {Array.from({ length: rows - 1 }).map((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <path key={`v${r}-${c}`} d={scribble(x + c * cw + 7, y + (r + 1) * rh + rh / 2 + 1, lens[(r + c) % 4]!, 1)} style={ln(p.pencil, 1.1)} />
        )),
      )}
      <rect
        x={x + 2 * cw}
        y={y + 3 * rh}
        width={cw}
        height={rh}
        style={{ ...ln(p.acid, 2.6), ...move(on, `translate(${cw}px, ${rh}px)`) }}
      />
      {ex ? (
        <g>
          <path d={`M${x} ${y + h + 58} h${w}`} style={ln(p.ink, 1.2)} />
          {[14, 22, 18, 30, 26, 38].map((bh, i) => (
            <rect
              key={`b${i}`}
              x={x + 14 + i * 26}
              y={y + h + 58 - bh}
              width={12}
              height={bh}
              style={{ ...sh(p.ink, i === 5 ? p.acid : p.sunk, 1.2), ...play(on, `lasso-sk-grow 480ms var(--ease-spring) ${i * 60}ms both`, 'bottom') }}
            />
          ))}
        </g>
      ) : null}
    </g>
  );
}

/** Hover: the call plays. The waveform breathes and the playhead travels. */
function Transcript({ p, ex, on }: P) {
  const y = 22;
  const amps = [3, 7, 4, 10, 6, 12, 5, 8, 14, 6, 9, 4, 11, 7, 3, 8, 12, 5, 7, 4, 9, 6, 3, 5];
  const rows = ex ? 5 : 4;
  const rh = ex ? 28 : 32;
  const lens = [96, 74, 104, 60, 88];
  return (
    <g>
      {amps.map((a, i) => (
        <path
          key={i}
          d={`M${36 + i * 7} ${y - a / 2} v${a}`}
          style={{ ...ln(p.ink, 1.6), ...play(on, `lasso-sk-pulse 700ms var(--ease-standard) ${(i % 6) * 70}ms infinite`) }}
        />
      ))}
      <path d={`M${36 + 9 * 7} ${y - 12} v24`} style={{ ...ln(p.acid, 2.6), ...play(on, 'lasso-sk-play 2200ms linear infinite') }} />
      {Array.from({ length: rows }).map((_, i) => {
        const cy = y + 32 + i * rh;
        const secs = i * 47 + 12;
        const at = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        return (
          <g key={i}>
            <circle cx={44} cy={cy} r={7} style={sh(p.ink, i % 2 ? p.paper : p.sunk, 1.3)} />
            <text x={57} y={cy + 4} style={hand(p.pencil, 10)}>{at}</text>
            <path d={scribble(86, cy - 2, lens[i]!)} style={ln(p.ink, 1.2)} />
            {i % 2 === 0 ? <path d={scribble(86, cy + 6, 50)} style={ln(p.pencil, 1.1)} /> : null}
          </g>
        );
      })}
    </g>
  );
}

const BODY: Record<WorkKind, (props: P) => React.ReactElement> = {
  deck: Deck,
  doc: Doc,
  chat: Chat,
  sheet: Sheet,
  transcript: Transcript,
  email: Email,
};

export function Sketch({
  kind,
  tone = 'bone',
  detail = 'compact',
  label = '',
  active = false,
}: {
  kind: WorkKind;
  tone?: SketchTone;
  detail?: SketchDetail;
  label?: string;
  /** Hover. Plays this kind's small motion; static when false. */
  active?: boolean;
}) {
  const id = React.useId().replace(/:/g, '');
  const Body = BODY[kind];
  return (
    <svg
      viewBox={VIEW[kind][detail]}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: 'block', overflow: 'hidden' }}
    >
      <defs>
        <filter id={`wob${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale={2.4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#wob${id})`}>
        <Body p={PAL[tone]} ex={detail === 'expanded'} label={label} on={active} />
      </g>
    </svg>
  );
}

/** The label measure, reachable from the component for hosts and tests. */
Sketch.labelWidth = handTextWidth;

/** The face a card wears when the real work cannot be shown. Still Lasso's hand. */
export function NoPreviewSketch({ tone = 'bone' }: { tone?: SketchTone }) {
  const id = React.useId().replace(/:/g, '');
  const p = PAL[tone];
  return (
    <svg viewBox="68 12 104 156" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden style={{ display: 'block', overflow: 'hidden' }}>
      <defs>
        <filter id={`nowob${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale={2.4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#nowob${id})`}>
        <path d="M74 18 h74 l18 18 v126 h-92 z" style={sh(p.ink, p.paper, 1.6)} />
        <path d="M148 18 v18 h18" style={ln(p.ink, 1.2)} />
        <path d="M98 74 q5 -7 10 0" style={ln(p.ink, 1.6)} />
        <path d="M132 74 q5 -7 10 0" style={ln(p.ink, 1.6)} />
        <path d="M100 126 q20 -16 40 0" style={ln(p.ink, 1.6)} />
      </g>
    </svg>
  );
}
