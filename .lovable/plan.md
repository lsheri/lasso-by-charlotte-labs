# Home page: pencil section titles + scroll focus

Two changes to the logged-out home page only. No content, routing, video, or backend changes.

## 1. Pencil-style section titles

Every content section gets a large handwritten pencil-style heading, so the page reads as a scannable notebook rather than a wall of monospace labels.

- Load a handwritten font (Caveat, weights 500/700) via a `<link>` in the root route head, and register it in `src/styles.css` as `--font-pencil`.
- Add a `pencil-title` utility: the handwritten family, large (about 34px mobile / 48px desktop), graphite color, slight negative rotation is avoided — kept straight for readability.
- The existing tiny mono micro-labels (WHAT ACCUMULATES, PRIVACY DEMONSTRATED, HOW IT WORKS) stay where they are as small eyebrow labels; each section gains a real pencil heading below it:
  - Work artifact clip: "How the work was made"
  - Fact check clip: "What was never checked"
  - What accumulates: "What accumulates"
  - Privacy demo: "What a coach sees" (existing heading, restyled to pencil)
  - How it works: "How it works"
- The existing one-line captions stay unchanged beneath each new heading.
- Hero headline stays Archivo bold as shipped; the animated graphite rule stays.

## 2. Scroll focus (fade + slight blur)

- New `useSectionFocus` hook plus a small `FocusSection` wrapper in `src/components/marketing/`.
- Each top-level section is wrapped. An IntersectionObserver with multiple thresholds tracks how much of each section sits in the viewport; the section closest to the vertical center of the screen is "active".
- Active section: full opacity, no blur. Others: opacity ~0.35 and `blur(2.5px)`, transitioning over ~400ms.
- The header, footer, and the bottom CTA link are never blurred.
- `prefers-reduced-motion` and small screens (< md): effect disabled entirely, everything renders crisp.
- Uses CSS transitions on a class toggle, not per-frame scroll math, so scrolling stays smooth.

## Technical notes

- Files touched: `src/routes/__root.tsx` (font link), `src/styles.css` (font token, `pencil-title` utility, focus classes/keyframes), `src/routes/index.tsx` (headings + section wrappers), new `src/components/marketing/FocusSection.tsx`.
- The existing Tetris-style left/right offsets on each section are preserved; the focus wrapper sits inside them so transforms do not conflict.
- Tests: extend `src/lib/__tests__/pass138-landing.test.tsx` to pin the new heading strings, the pencil title class, and that the focus wrapper honors reduced motion. All existing copy assertions must keep passing; no banned words are introduced.
