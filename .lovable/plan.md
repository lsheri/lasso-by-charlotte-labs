# Landing unit L1: B2B landing rebuild

## Data impact
- Replace the hidden `/landing-next` study with one B2B landing flow and a local pilot form confirmation.
- Keep `landing.viewed`, setting `variant: b2b`, and add `landing.pilot_cta_clicked { location: hero | pilot }` through the existing anonymous, consent-stamped path. No form contents are recorded.
- No consent surfaces, database work, or changes to `/`.
- Portal catalog update required for the new pilot CTA event.

## Build
- Recompose only `/landing-next` using the supplied copy, four-panel sequence, existing imagery, and available clips. Missing media remains a dashed slot.
- Add the non-sending pilot form with local validation and confirmation.
- Extend `ClipPlayer` with opt-in `playback="hold"`: no loop, two-second end hold, then restart; default behavior remains unchanged for `/`.
- Update only landing-specific styles and focused landing/clip tests. Add the new event to the canonical additive event-name union because the anonymous function requires it.

## Control and state contract
### Before
- Header navigation and sign-in; two hero auth actions; scroll cue; privacy toggle; five clip panels including 1:1; reduced-motion clip play controls; bottom personal/contact links; footer links.
- Clip states: off-screen paused, visible playing, reduced-motion poster/manual play, missing/poster placeholder.
- Events: `landing.viewed { variant: a|b, surface: landing-next }`.

### After
- Header and footer remain; hero gains Book a pilot, See how it works, and Start your own record; four clip panels; privacy toggle; pilot form controls; reduced-motion play controls.
- Clip states remain, with opt-in ended/2-second hold/restart; form adds initial, invalid, and confirmed states.
- Events: `landing.viewed { variant: b2b, surface: landing-next }`; `landing.pilot_cta_clicked { location: hero|pilot }`.

## Verification
- Run the existing landing and ClipPlayer tests plus a hold-restart test.
- Run the requested prohibited-language scan and report zero hits.
- Check the automatic build result. Skip browser checks as requested.
