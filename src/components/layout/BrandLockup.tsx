/**
 * Horizontal brand lockup for the front door: the lasso loop mark and the
 * LASSO wordmark used in the landing header.
 *
 * The loop is inlined as an SVG so the sign-in page never depends on an
 * expiring Figma asset URL or an external image fetch.
 */
import { LassoLoopMark } from "./LassoLoopMark";

const SIZES = {
  sm: { mark: "h-6 w-6", word: "text-base" },
  md: { mark: "h-8 w-8", word: "text-xl" },
  lg: { mark: "h-10 w-10", word: "text-2xl" },
} as const;

export function BrandLockup({
  size = "lg",
  className = "",
  markClassName = "text-lasso-green",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  markClassName?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LassoLoopMark className={`${s.mark} shrink-0 ${markClassName}`} />
      <span className={`font-mono ${s.word} tracking-[0.24em] text-foreground`}>LASSO</span>
    </span>
  );
}
