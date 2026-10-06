# TVd teaching layer

## Data impact
- Coverage: visual guidance changes only. Existing actions and transitions remain; no telemetry event is added or changed.
- Consent: no consent surfaces, stamping, or consent tables are touched.
- Schema and portal: no event name, payload, or dimension changes. No database work.

## Control and state contract
- Before and after controls remain identical: eight act targets, Back, Skip, act-specific controls, and final action.
- Existing render states remain, with the active target receiving a shared glow. Act 3 switches that one target from Add work to its chat row when the picker opens.
- Telemetry before and after: none in the local tour.

## Changes
- Drive a shared lime outline and pulse entirely from the active `data-tour-target`; retain a static glow under reduced motion.
- Ensure each act has exactly one current target, including sequential targets where an act requires more than one click.
- Move each unchanged teaching sentence into one hand-drawn callout bubble above the act surface on phone and beside it on desktop.
- Replace the slide’s hardcoded owner with the register-aware board owner.
- Add strict tests for target uniqueness and transitions, bubble placement semantics, arrow paths, reduced motion, owner copy, and unchanged geometry.

## Verification
- Run focused tour tests and inspect all eight acts, including Act 3’s target handoff, at 1280px and 390px.
- Run the full Vitest suite once after the final edit and report only failures beyond the nine named baseline files.
- Run `bun run build`; preview only, never publish.

## Read-only follow-up
- Report real Ask Lasso scopes and controls with file/function evidence.
- Report whether a real board renders a deck or presentation and which component does it.
