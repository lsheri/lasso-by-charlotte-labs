# Five-form Lasso motion sequence

## Data impact

- Visual motion only. No user action, surface, flow, event name, event payload, consent behavior, or stored data changes.
- Existing controls and render states remain unchanged. The animation has no controls or telemetry calls.

## Build

- Keep the current clock-face, horizon, loose-motion, and resolve timing inside the shared Lasso mark.
- Replace the single resolved target with five handcrafted particle paths in a fixed repeating order:
  1. Swirly cursive capital L
  2. First uploaded mythical symbol
  3. Second uploaded mythical symbol
  4. Third uploaded mythical symbol
  5. Fourth uploaded mythical symbol
- Advance one target per complete 5.2-second cycle, so every group of five cycles always preserves that order.
- Fit all five forms inside the existing square at 28px, 36px, 56px, and 72px without changing component props, call sites, placement, or layout.
- Keep the existing lime token, dimensional depth, seeded irregular motion, offscreen pause, and particle rendering.
- For reduced motion, show a crisp static cursive L without scheduling animation.

## Verification

- Add geometry checks for fixed sequence order, cycle wrapping, distinct silhouettes, containment, and reduced-motion output.
- Run the focused Lasso motion, placement, Home, toolbar, and thinking-trail checks plus type safety.
- Inspect the live 72px Home mark and any accessible compact placement for legibility and layout stability.
