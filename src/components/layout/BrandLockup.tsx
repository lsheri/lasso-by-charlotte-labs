/**
 * Horizontal brand lockup: the skin's mark and wordmark. Lasso shows the loop and LASSO; Charlotte shows the C with
 * its lime hub and CHARLOTTE (Phase 4: every surface follows the skin, so nothing mixes the two brands).
 *
 * The loop is inlined as an SVG so the sign-in page never depends on an
 * expiring Figma asset URL or an external image fetch.
 */
import { useBrand } from "@/components/skin/use-skin";
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
}: {
  size?: keyof typeof SIZES;
  className?: string;
  markClassName?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <BrandMark className={`${s.mark} shrink-0 ${markClassName}`} px={s.px} />
      <span className={`font-mono ${s.word} tracking-[0.24em] text-foreground`}>{useBrand().wordmark}</span>
    </span>
  );
}

/**
 * The skin's still mark, wherever Lasso drew its loop: the C with its lime hub under Charlotte, the loop in Lasso.
 * Lasso keeps the caller's className exactly; Charlotte sizes a fixed block to `px`, matching the class's size.
 */
export function BrandMark({ className = "", px }: { className?: string; px: number }) {
  if (useBrand().look.mark !== "charlotte") return <LassoLoopMark className={className} />;
  return (
    <span className="shrink-0" style={{ display: "block", width: px, height: px }} aria-hidden="true" data-skin-mark="charlotte">
      <CharlotteMark state="live" size={px} />
    </span>
  );
}

/** The skin's wordmark as text, for lockups that set their own type (landing, demo). */
export function BrandWordmark() {
  return <>{useBrand().wordmark}</>;
}
