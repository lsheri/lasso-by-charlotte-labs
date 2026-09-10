/**
 * Horizontal brand lockup for the front door: the lasso loop mark, the Lasso
 * word in the serif display type, and the "by Charlotte Labs" hand caption.
 *
 * The loop is inlined as an SVG so the sign-in page never depends on an
 * expiring Figma asset URL or an external image fetch.
 */
import { LassoLoopMark } from "./LassoLoopMark";

export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <LassoLoopMark className="h-10 w-10 shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="font-serif text-2xl text-foreground">Lasso</span>
        <span className="font-hand text-[11.5px] text-green">by Charlotte Labs</span>
      </div>
    </div>
  );
}
