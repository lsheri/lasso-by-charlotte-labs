import { useMotion } from "@/hooks/use-motion";
import type { CSSProperties } from "react";

interface NotebookSpiderProps {
  size?: number;
  reading?: boolean;
  className?: string;
}

/**
 * Sandbox A · M10 "Spider processes · reading your work".
 *
 * The artwork is the exported drawing from the design file, inlined piece by
 * piece. Figma positions each piece by percentage inset inside a 180 × 130
 * frame, with a second nested inset for stroke bleed, so the pieces are nested
 * boxes here rather than flattened into one viewBox: the frame is not square,
 * so a hand-merged viewBox would drift.
 *
 * The raster mascot beside "Ask Lasso" is unrelated and stays where it is.
 */

const FRAME_W = 180;
const FRAME_H = 130;

/** inset and bleed are [top, right, bottom, left] in percent. */
interface Piece {
  inset: [number, number, number, number];
  bleed?: [number, number, number, number];
  viewBox: string;
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

const GRAPHITE = "var(--nb-graphite)";
const PAPER = "var(--nb-white)";

/** abdomen, head, smile and the eight legs — everything except the eyes. */
const BODY_PIECES: Piece[] = [
  {
    // abdomen
    inset: [32.31, 25.56, 24.62, 36.67],
    bleed: [-2.14, -1.76, -2.14, -1.76],
    viewBox: "0 0 70.4 58.4",
    d: "M35.2 57.2C53.9777 57.2 69.2 44.664 69.2 29.2C69.2 13.736 53.9777 1.2 35.2 1.2C16.4223 1.2 1.2 13.736 1.2 29.2C1.2 44.664 16.4223 57.2 35.2 57.2Z",
    fill: PAPER,
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    // head
    inset: [20.77, 49.44, 50, 29.44],
    bleed: [-3.16, -3.16, -3.16, -3.16],
    viewBox: "0 0 40.4 40.4",
    d: "M20.2 39.2C30.6934 39.2 39.2 30.6934 39.2 20.2C39.2 9.70659 30.6934 1.2 20.2 1.2C9.70659 1.2 1.2 9.70659 1.2 20.2C1.2 30.6934 9.70659 39.2 20.2 39.2Z",
    fill: PAPER,
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
];

const SMILE_PIECE: Piece = {
  inset: [41.54, 56.11, 56.92, 36.67],
  bleed: [-50.01, -7.69, -50, -7.69],
  viewBox: "0 0 15.0003 4.00017",
  d: "M1.00017 1.00017C5.66684 3.66684 10.0002 3.66684 14.0002 1.00017",
  stroke: GRAPHITE,
  strokeWidth: 2,
};

const LEG_PIECES: Piece[] = [
  {
    inset: [67.69, 60, 4.62, 23.33],
    bleed: [-3.33, -4, -3.33, -4],
    viewBox: "0 0 32.4004 38.4004",
    d: "M31.2002 1.20018C11.2002 13.2002 3.20019 25.2002 1.20019 37.2002",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    inset: [73.85, 52.22, 4.62, 42.93],
    bleed: [-4.29, -13.76, -4.29, -13.76],
    viewBox: "0 0 11.1219 30.4004",
    d: "M9.9218 1.20013C1.9218 13.2001 -0.0781955 21.2001 1.9218 29.2001",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    inset: [73.85, 30.83, 4.62, 63.33],
    bleed: [-4.29, -11.42, -4.29, -11.42],
    viewBox: "0 0 12.9099 30.4004",
    d: "M1.20013 1.20013C9.20013 13.2001 13.2001 21.2001 11.2001 29.2001",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    inset: [63.08, 15.56, 10.77, 71.11],
    bleed: [-3.53, -5, -3.53, -5],
    viewBox: "0 0 26.4002 36.4002",
    d: "M1.20022 1.20022C19.2002 11.2002 25.2002 23.2002 25.2002 35.2002",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    inset: [49.23, 61.11, 44.62, 13.33],
    bleed: [-15, -2.61, -15, -2.61],
    viewBox: "0 0 48.4003 10.4001",
    d: "M47.2001 3.19997C25.2001 -0.800026 13.2001 1.19997 1.20013 9.19997",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    inset: [41.83, 7.78, 53.85, 72.22],
    bleed: [-21.34, -3.33, -21.34, -3.33],
    viewBox: "0 0 38.4005 8.02298",
    d: "M1.20033 4.82279C17.2003 -1.17721 27.2003 0.822795 37.2003 6.82279",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    inset: [11.93, 66.67, 76.92, 20],
    bleed: [-8.28, -5, -8.28, -5],
    viewBox: "0 0 26.4003 16.8911",
    d: "M25.2003 15.691C15.2003 3.69103 9.20028 -0.308969 1.20028 1.69103",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
  {
    inset: [10.39, 42.22, 78.46, 46.67],
    bleed: [-8.28, -6, -8.28, -6],
    viewBox: "0 0 22.4005 16.8911",
    d: "M1.20026 15.6908C7.20026 3.69082 13.2003 -0.309175 21.2003 1.69082",
    stroke: GRAPHITE,
    strokeWidth: 2.4,
  },
];

const EYE_PIECES: Piece[] = [
  {
    // left eye
    inset: [30.77, 61.67, 64.62, 35],
    viewBox: "0 0 6 6",
    d: "M3 6C4.65685 6 6 4.65685 6 3C6 1.34315 4.65685 0 3 0C1.34315 0 0 1.34315 0 3C0 4.65685 1.34315 6 3 6Z",
    fill: GRAPHITE,
  },
  {
    // right eye
    inset: [30, 55.56, 65.38, 41.11],
    viewBox: "0 0 6 6",
    d: "M3 6C4.65685 6 6 4.65685 6 3C6 1.34315 4.65685 0 3 0C1.34315 0 0 1.34315 0 3C0 4.65685 1.34315 6 3 6Z",
    fill: GRAPHITE,
  },
];

function insetStyle([t, r, b, l]: [number, number, number, number]): CSSProperties {
  return {
    position: "absolute",
    top: `${t}%`,
    right: `${r}%`,
    bottom: `${b}%`,
    left: `${l}%`,
  };
}

function PieceLayer({ piece }: { piece: Piece }) {
  const inner = (
    <svg
      viewBox={piece.viewBox}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      fill="none"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <path
        d={piece.d}
        fill={piece.fill ?? "none"}
        stroke={piece.stroke}
        strokeWidth={piece.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // A pencil line is the same weight whether the spider is drawn at 44px
        // in the work legend or at 132px in the reading state.
        vectorEffect={piece.stroke ? "non-scaling-stroke" : undefined}
      />
    </svg>
  );

  return (
    <div style={insetStyle(piece.inset)}>
      {piece.bleed ? (
        <div style={insetStyle(piece.bleed)}>{inner}</div>
      ) : (
        <div style={{ position: "absolute", inset: 0 }}>{inner}</div>
      )}
    </div>
  );
}

const FILL_BOX: CSSProperties = { position: "absolute", inset: 0 };

export function NotebookSpider({
  size = 120,
  reading = false,
  className = "",
}: NotebookSpiderProps) {
  return (
    <div
      aria-hidden="true"
      className={`nb-spider ${reading ? "nb-spider-reading" : ""} ${className}`}
      style={{
        position: "relative",
        width: size,
        height: (size * FRAME_H) / FRAME_W,
      }}
    >
      <div className="nb-spider-body" style={FILL_BOX}>
        {BODY_PIECES.map((piece, i) => (
          <PieceLayer key={`body-${i}`} piece={piece} />
        ))}
        {/* the eyes travel with the body; the scan is additional motion on top */}
        <div className="nb-spider-eyes" style={FILL_BOX}>
          {EYE_PIECES.map((piece, i) => (
            <PieceLayer key={`eye-${i}`} piece={piece} />
          ))}
        </div>
        <PieceLayer piece={SMILE_PIECE} />
        {LEG_PIECES.map((piece, i) => (
          <PieceLayer key={`leg-${i}`} piece={piece} />
        ))}
      </div>
    </div>
  );
}

/**
 * The reading spider with its caption row. Used by motion surfaces that resolve
 * to the `spider-processes` class.
 */
export function SpiderReading({
  caption = "Reading your work",
  className = "",
}: {
  caption?: string;
  className?: string;
}) {
  const motion = useMotion("spider.guiding");
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <NotebookSpider size={132} className={motion.className} />
      <div className="mt-[18px] flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
          {caption}
        </span>
        <span className="flex items-center gap-[5px]">
          <span
            className="nb-spider-dot block h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: "var(--nb-green)" } as CSSProperties}
          />
          <span
            className="nb-spider-dot block h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: "var(--nb-green)" } as CSSProperties}
          />
          <span
            className="nb-spider-dot block h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: "var(--nb-green)" } as CSSProperties}
          />
        </span>
      </div>
    </div>
  );
}
