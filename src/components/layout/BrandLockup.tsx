/**
 * Horizontal brand lockup for the front door: the lasso loop mark, the Lasso
 * word in the serif display type, and the "by Charlotte Labs" hand caption.
 *
 * The loop is inlined as an SVG so the sign-in page never depends on an
 * expiring Figma asset URL or an external image fetch.
 */
export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        className="h-10 w-10 shrink-0"
        viewBox="0 0 40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14S27.7 6 20 6z" />
        <path d="M20 6c5.5 0 9 4.5 9 14s-3.5 14-9 14" />
        <path d="M29 20l7 7" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="font-serif text-2xl text-foreground">Lasso</span>
        <span className="font-hand text-[11.5px] text-green">by Charlotte Labs</span>
      </div>
    </div>
  );
}
