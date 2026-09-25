# Unit L3 plan

## Scope and data impact
- Change only `/landing-board` presentation and replay behavior.
- Keep all existing event names, dimensions, dwell timing, snap behavior, and consent handling unchanged.
- No database work and no publishing.

## Build
- Route all board tool identities through one Simple Icons backed map, with a PowerPoint text fallback and one-line PNG overrides.
- Replace the six generic tiles with compact, truthful 16:9 client-deck compositions.
- Measure the visible `$1.4M` callout against the transformed board layer and position the ellipse from unscaled coordinates.
- Keep Ask replay non-scrollable through story steps, pin streamed content to its bottom, and restore scrolling only for the handoff.
- Key caption and target attention motion to settled steps, with reduced-motion equivalents.

## Verify
- Extend focused source tests for logo coverage, caption settling, reduced motion, and Ask overflow behavior.
- Check steps 3, 5, 6, and 8 at desktop and phone sizes.
- Measure lasso and number centers at 1372x732, 1440x900, and 390x844.
