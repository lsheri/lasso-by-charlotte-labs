/**
 * Horizontal brand lockup for the front door: the lasso loop mark and the
 * LASSO wordmark used in the landing header.
 *
 * The loop is inlined as an SVG so the sign-in page never depends on an
 * expiring Figma asset URL or an external image fetch.
 */
import { useSkin } from "@/components/skin/use-skin";
import { CharlotteMark } from "@/design/brand/CharlotteMark";

import { LassoLoopMark } from "./LassoLoopMark";

const SIZES = {
  sm: { mark: "h-6 w-6", px: 24, word: "text-base" },
  md: { mark: "h-8 w-8", px: 32, word: "text-xl" },
  lg: { mark: "h-10 w-10", px: 40, word: "text-2xl" },
} as const;

export function BrandLockup({
  size = "lg",
  className = "",
  markClassName = "text-lasso-green",
  skinned = false,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  markClassName?: string;
  /** Signed-in shell only (PR7): under Charlotte the lime loop becomes the still navy C. Public pages never pass it. */
  skinned?: boolean;
}) {
  const s = SIZES[size];
  const charlotte = useSkin() === "charlotte" && skinned;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {charlotte ? (
        <span className="shrink-0" style={{ display: "block", width: s.px, height: s.px }} aria-hidden="true" data-skin-mark="charlotte">
          <CharlotteMark state="idle" size={s.px} />
        </span>
      ) : (
        <LassoLoopMark className={`${s.mark} shrink-0 ${markClassName}`} />
      )}
      <span className={`font-mono ${s.word} tracking-[0.24em] text-foreground`}>LASSO</span>
    </span>
  );
}

/** The loop on a board's side rail (PR7): the still navy C under Charlotte, the lime loop in Lasso. */
export function ShellMark({ className = "h-7 w-7 text-lasso-green", px = 28 }: { className?: string; px?: number }) {
  if (useSkin() !== "charlotte") return <LassoLoopMark className={className} />;
  return (
    <span className="shrink-0" style={{ display: "block", width: px, height: px }} aria-hidden="true" data-skin-mark="charlotte">
      <CharlotteMark state="idle" size={px} />
    </span>
  );
}
