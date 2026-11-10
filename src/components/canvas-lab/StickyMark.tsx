import { useId } from "react";

import type { WorkboardStickyFill } from "@/lib/canvas-lab-shared";

/*
 * S1 (stickies on the work, 10 Nov, Liam): one sticky drawing everywhere a sticky is offered or shown.
 * - "stack": three real-paper sheets fanned out, turquoise at the back, mint in the middle, yellow on top.
 *   It is where you pick a sticky up: the board toolbar, and the one view's rail (S2).
 * - "sheet": one real-paper sheet in the sticky's own colour. It is a sticky that exists: on the work (S2)
 *   and the corner sticky on a board card (S3).
 * The colours are the board's sticky colours, one step richer so the mark still reads at toolbar size.
 */

/** What a person calls each sticky colour. The stored keys never change; "blue" now draws turquoise. */
export const STICKY_FILL_NAMES: Record<WorkboardStickyFill, string> = {
  yellow: "Yellow",
  green: "Mint",
  blue: "Turquoise",
  pink: "Pink",
  grey: "Grey",
};

/** Paper colours for the mark: top of the sheet, bottom of the sheet, and the lifted corner. */
export const STICKY_MARK_PAPER: Record<
  WorkboardStickyFill,
  { top: string; bottom: string; curl: string }
> = {
  yellow: { top: "#ffe98a", bottom: "#ffd94d", curl: "#e8c23a" },
  green: { top: "#c9f5dc", bottom: "#9fe7bf", curl: "#79d4a3" },
  blue: { top: "#8ee6e0", bottom: "#4fcfc6", curl: "#33b3aa" },
  pink: { top: "#fbd3df", bottom: "#f5adc2", curl: "#e78ea8" },
  grey: { top: "#efefec", bottom: "#d9d9d4", curl: "#bdbdb6" },
};

type Props = {
  variant: "stack" | "sheet";
  /** The sheet's colour. The stack is always turquoise, mint and yellow. */
  fill?: WorkboardStickyFill | undefined;
  size?: number | undefined;
  className?: string | undefined;
  /** Lines on the top sheet. Off when a number or a face sits on the sticky. */
  lines?: boolean | undefined;
};

function Sheet({
  id,
  fill,
  x,
  y,
  rotate,
  lines,
}: {
  id: string;
  fill: WorkboardStickyFill;
  x: number;
  y: number;
  rotate: number;
  lines: boolean;
}) {
  const paper = STICKY_MARK_PAPER[fill];
  const w = 14;
  const h = 13.5;
  const curl = 4.1;
  return (
    <g filter={`url(#${id}-soft)`} transform={`rotate(${rotate} ${x + w / 2} ${y + h / 2})`}>
      <linearGradient id={`${id}-${fill}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={paper.top} />
        <stop offset="1" stopColor={paper.bottom} />
      </linearGradient>
      <path
        d={`M${x} ${y}h${w}v${h - curl}L${x + w - curl} ${y + h}H${x}z`}
        fill={`url(#${id}-${fill})`}
      />
      <path
        d={`M${x + w} ${y + h - curl} ${x + w - curl} ${y + h}c.3-1.8.2-3.3 0-4.1 1 .2 2.3.2 4.1 0z`}
        fill={paper.curl}
      />
      <path d={`M${x} ${y}h${w}v1.3H${x}z`} fill="#fff" opacity=".35" />
      {lines ? (
        <path
          d={`M${x + 2.5} ${y + 4.5}h7M${x + 2.5} ${y + 7}h5`}
          stroke="#000"
          strokeOpacity=".22"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}

export function StickyMark({
  variant,
  fill = "yellow",
  size = 22,
  className,
  lines = true,
}: Props) {
  // One id per drawing: two marks on a page must not share a gradient or a shadow.
  // The size is inline because buttons force their icons to 16px, and the stack needs its 22.
  const id = `sm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-sticky-mark={variant}
      style={{ width: size, height: size, overflow: "visible", display: "block", flexShrink: 0 }}
    >
      <defs>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="1.1" stdDeviation="1" floodColor="#000" floodOpacity=".22" />
        </filter>
      </defs>
      {variant === "stack" ? (
        <>
          <Sheet id={id} fill="blue" x={2} y={6} rotate={-14} lines={false} />
          <Sheet id={id} fill="green" x={5} y={4} rotate={-5} lines={false} />
          <Sheet id={id} fill="yellow" x={8} y={6.5} rotate={6} lines={lines} />
        </>
      ) : (
        <Sheet id={id} fill={fill} x={4.5} y={5} rotate={0} lines={lines} />
      )}
    </svg>
  );
}
