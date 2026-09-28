# L3 particle headline loop

## Scope
Update exactly these four product files:
- `src/components/marketing/LandingParticlePhrase.tsx`
- `src/components/marketing/__tests__/l1-headline-visible.test.ts`
- `src/components/marketing/__tests__/landing-particle-phrase.test.ts`
- `src/lib/__tests__/u4-landing-beats.test.ts`

No CSS, layout, copy, route, database, dependency, or Supabase changes. Nothing will be published.

## Data platform gate
- **Coverage:** No user action, surface, or flow is added or removed. This only changes existing decorative headline motion, so no telemetry event is added.
- **Consent:** No consent surface, consent state, event stamping, or consent table is touched.
- **Schema and portal:** No event name, payload, or dimension changes.

## Control rule
**Before:** no interactive controls and no telemetry calls. Render states are one active gather, completed solid text, reduced motion, hidden document, cleanup, thrown frame, and pre-intersection.

**After:** no interactive controls and no telemetry calls. Render states are looping while visible, solid while offscreen, reduced motion, hidden document, cleanup, thrown frame, and pre-intersection. The viewport observer restarts a fresh shared cycle on re-entry.

## Implementation
1. Define the 5,000ms cycle and 2,200ms gather constants, with hold ending at 4,000ms.
2. Keep one phrase-owned start timestamp shared by every word.
3. Compute text opacity continuously from cycle position:
   - gather: eased 0 to 1 during its last 55%
   - hold: an eased expression evaluating to 1
   - disperse: eased 1 to 0
   - wrap: 0 to 0
4. Draw particles only during gather and disperse, moving inward then outward. Clear the canvas during hold.
5. Keep all safety exits solid: reduced motion, offscreen pause, hidden page, cleanup, cancellation, and frame errors set opacity to 1 and stop frames.
6. Keep the phrase-level viewport observer connected so leaving pauses and re-entry starts one fresh shared cycle.
7. Repin only the particle-contract assertions in the three approved tests. Preserve all unrelated assertions.

## Verification
- Run the focused particle tests, then the full suite and compare failures with the known baseline.
- At 1280px, sample one word every 250ms for 11 seconds and report the full series, largest adjacent change and timestamp.
- Confirm all words expose one distinct shared start timestamp.
- Scroll the phrase offscreen, wait 2,000ms, and confirm opacity is 1 with no animation frames still firing.
- Check the latest build diagnostics and confirm only the four approved product files changed.
