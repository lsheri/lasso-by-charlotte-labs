/**
 * Horizontal brand lockup for the front door: the lasso loop mark and the
 * LASSO wordmark used in the landing header.
 *
 * The loop is inlined as an SVG so the sign-in page never depends on an
 * expiring Figma asset URL or an external image fetch.
 */
import { LassoLoopMark } from "./LassoLoopMark";

export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <LassoLoopMark className="h-10 w-10 shrink-0 text-lasso-green" />
      <span className="font-mono text-2xl tracking-[0.24em] text-foreground">LASSO</span>
    </div>
  );
}
