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
 * A vector spider for motion surfaces where the raster mascot beside "Ask Lasso"
 * cannot go. It is hand-drawn, stays still by default, and only animates when
 * `reading` is true and the reader has not asked for reduced motion.
 */
export function NotebookSpider({
  size = 120,
  reading = false,
  className = "",
}: NotebookSpiderProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      className={`nb-spider ${reading ? "nb-spider-reading" : ""} ${className}`}
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      // The spider is drawn at 44px in the work legend and 132px in the
      // reading state. A pencil line is the same weight in both places, so the
      // stroke stays a constant screen width instead of scaling with the viewBox.
      vectorEffect="non-scaling-stroke"
    >
      <g className="nb-spider-body">
        {/* 8 legs — two curling up from the head, two out to the sides, four down */}
        <path d="M35 27 C28 18 25 11 27 6" />
        <path d="M55 23 C60 14 64 9 62 5" />
        <path d="M32 46 C20 44 12 46 8 50" />
        <path d="M86 54 C96 50 102 50 106 54" />
        <path d="M48 78 C40 86 32 94 28 112" />
        <path d="M58 80 C56 92 54 100 52 114" />
        <path d="M70 80 C72 92 74 100 76 114" />
        <path d="M80 74 C88 84 94 96 98 110" />
        {/* abdomen, then head, both filled so the legs do not read through */}
        <ellipse cx="64" cy="62" rx="23" ry="19" fill="var(--nb-white)" />
        <ellipse cx="46" cy="36" rx="16.5" ry="15" fill="var(--nb-white)" />
        {/* the smile sits on the head and does not scan with the eyes */}
        <path d="M40 41 Q45.5 45.5 51 41" />
        <g className="nb-spider-eyes">
          <circle cx="40" cy="32" r="2" fill="var(--nb-graphite)" stroke="none" />
          <circle cx="51" cy="32" r="2" fill="var(--nb-graphite)" stroke="none" />
        </g>
      </g>
    </svg>
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
