# Landing headline particle loop

## Goal
Replace the green highlighter behind “The human judgment, process, and thinking” with a continuous particle sequence:

1. Lasso-green particles gather into the exact words.
2. The words resolve in dark graphite and remain fully readable for 2 seconds.
3. The words break back into green particles and disappear.
4. The sequence pauses briefly, then repeats while the headline is visible.

The headline copy, line wrapping, page structure, and surrounding content stay unchanged. People who prefer reduced motion see the phrase as static dark graphite text.

## Implementation
- Add a small landing-only canvas component for the animated phrase.
- Keep the real phrase in the document for accessibility, search, and stable headline sizing.
- Measure each word’s actual rendered position so the particles form the same wrapped text on desktop and mobile.
- Build a deterministic particle field from the rendered letter shapes, using the existing Lasso green and graphite tokens.
- Stop animation work when the headline leaves the viewport and rebuild safely after resizing.
- Remove the existing highlighter animation and its unused styles.
- Keep this isolated to the landing page so the signed-in welcome glyph and other product motion remain unchanged.

## Control and state contract
**Before:** Header home link, Why Lasso link, Trust & data link, Sign in link, header pilot link, hero pilot link, See it work link, personal-record link, use-case video controls, reduced-motion hero-video Play control, close pilot link, pilot form fields and submit control, email/site/LinkedIn links, and footer navigation.

**After:** The same controls, with the same handlers and destinations. The new headline sequence has no control and introduces no user action.

**Existing render states preserved:** use-case poster available/unavailable, video ready/failed/playing, hero video autoplay or reduced-motion Play, close statement unresolved/resolved, pilot form idle/submitting/success/error.

**New visual states only:** particles gathering, graphite phrase held for exactly 2 seconds, particles dispersing, brief empty interval, reduced-motion static phrase. These states do not change content or expose a control.

## Data impact
- No new or changed user action, surface, or flow.
- No event name, payload, or dimension change.
- Existing events remain exactly: `landing.viewed { variant: "b2b", surface }`, `landing.story_section_viewed { section, input_mode: "scroll" }`, `landing.usecase_played { card, input_mode }`, `landing.pilot_cta_clicked { location }`, `landing.pilot_cta_clicked { placement }`, `landing.see_it_work_clicked { location: "hero" }`, and `landing.pilot_requested { team_size }`.
- No consent-related code and no database work.
- No portal-side update required.

## Files
- `src/components/marketing/LandingParticlePhrase.tsx`: new presentational canvas animation.
- `src/components/marketing/B2BLanding.tsx`: replace only the highlighted phrase wrapper.
- `src/styles.css`: remove the highlighter and add token-based layout styling for the phrase overlay.
- Focused landing tests: assert unchanged copy, no highlighter, looping phase contract, 2-second hold, reduced-motion fallback, and no telemetry additions.

## Verification
- Run the focused landing, language-law, and motion tests.
- Check the full headline at desktop and mobile widths for wrapping, clipping, overlap, and stable layout.
- Visually confirm gather → dark phrase → 2-second hold → disperse → repeat.
- Confirm reduced motion shows the complete static phrase.
- Confirm the preview build remains clean.
