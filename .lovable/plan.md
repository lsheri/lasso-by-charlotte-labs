# R5 workboard toolbar

## Data impact
- Presentation-only changes to the existing workboard toolbar.
- No user action, handler, event name, payload, dimension, consent path, or database behavior changes.
- Existing actions remain covered by their current events. No portal-side update is required.

## Build
- Extend the existing `GraphiteIcon` hand-drawn SVG set rather than introduce another icon system.
- Reuse its existing `ask-lasso`, `work`, `messages`, `analyses`, `settings`, `plus`, and `close` gestures where each remains unique and semantically clear; add distinct hand-drawn toolbar glyphs for the remaining controls.
- Replace stock toolbar glyphs, including the Share trigger, while preserving every accessible name, tooltip, condition, handler, and overflow-menu action.
- Make Add work a compact icon-plus-text button and label Details and See an example board because their shapes are not sufficiently self-explanatory.
- Increase the planned and rendered toolbar gap together so overflow decisions continue matching the row.
- Give only Ask Lasso the lime loop-derived swirl, animated through transform-only, slow, overlapping 3D drift layers; disable all motion under reduced motion.

## Verification
- Add failing-first source and behavior checks for unique icon mapping, visible Add work text, lime exclusivity, motion/reduced motion, names/tooltips, and narrow-row overflow.
- Run the focused toolbar, grouping, card, event-contract, type, and preview-build checks.
- Compare the complete before/after control and render-state lists to ensure presentation is the only change.
