/**
 * The drawn lasso loop mark (Figma frame 12:2), inlined as SVG so no surface
 * depends on an expiring Figma asset URL or an external image fetch.
 *
 * Sizing and colour belong to the caller: pass a className for dimensions and
 * a text colour utility, since the strokes are `currentColor`.
 */
export function LassoLoopMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}
