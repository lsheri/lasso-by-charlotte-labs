# R7 Ask Lasso thinking marks

## Data impact
- Presentation only. No user action, surface, flow, consent behavior, event name, payload, or dimension changes.
- No database work.

## Current controls, states, and telemetry
- Workboard Ask control: toggles the existing board Ask surface; accessible name and tooltip are `Ask Lasso`; states are open and closed.
- Ask surface: empty conversation, prior messages, streamed answer, pending read/write, error, history loading/empty/populated, work picker open/closed, and composer enabled/disabled.
- Current pending treatment is `NbDots` plus the existing `ThinkingTrail`. A real source count becomes available only when `liveManifest.items` arrives; before that, no verified count exists.
- Existing telemetry remains exactly as implemented through the Ask Lasso hook and workboard handlers. This unit adds or changes no telemetry call.

## Build
1. Add one shared `LassoThinkingMark` canvas component for `orbit`, `loop`, `gather`, and `trace`, using the supplied projection and drawing formulas exactly.
2. Read `--nb-lasso-green` from computed styles, cap the backing-store ratio at 2, pause while off screen, cancel frames on cleanup, and draw one frame only under reduced motion.
3. Replace the toolbar’s nested CSS drift wrappers with the `loop` canvas mark. Remove the three superseded animations and reduced-motion CSS selectors.
4. Replace the pending `NbDots` treatment in the live Ask response area with `gather`. Use `liveManifest.items.length` only when the returned manifest exists; otherwise pass zero rather than implying unread sources. Keep the existing status text and `ThinkingTrail` unchanged.
5. Add focused checks first for all four marks, cleanup, reduced motion, zero-count gather, token-derived lime, toolbar wiring, removed CSS motion, and pending-state wiring.

## After-change parity
- Controls, handlers, accessible names, copy, render states, source trail, and telemetry remain unchanged.
- Only the visual mark in the toolbar and the visual pending indicator change.
