/** Decorative location loop; CSS owns activation and draw timing. */
export function NavActiveCatch() {
  return (
    <svg className="lasso-nav-catch" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        d="M206 9C180 2 96 1 46 7 11 11 4 24 20 31c20 9 112 10 164 2 34-5 52-14 40-22-9-6-33-9-62-9-9 0-14 1-18 3"
        pathLength={1} vectorEffect="non-scaling-stroke" strokeWidth={2.6} strokeLinecap="round" fill="none"
      />
    </svg>
  );
}
