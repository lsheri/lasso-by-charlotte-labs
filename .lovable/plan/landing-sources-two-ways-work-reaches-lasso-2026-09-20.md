# Landing sources: two ways work reaches Lasso

## What will change

Replace the single video in the B2B home page panel headed “Circle any fact. See where it came from.” with a paired sequence:

1. The supplied `Lasso_Connector_-_1-2.mov`, prepared for quiet landing-page playback with its own final-frame poster.
2. A newly created vertical phone video showing a staged Claude conversation, the user entering “Push to Lasso”, Claude thinking, the Lasso connector appearing in that thinking state, and the final message “Sent to Lasso”.

Together, the clips will show both paths: work arriving from connected tools and a person deliberately pushing work from an AI conversation.

## Presentation

- Keep the panel’s existing heading and approved copy unchanged.
- Replace only its current source-finding clip area with a composed two-video layout that fits the existing carousel at desktop and mobile sizes.
- Preserve the current landing rule for both clips: silent autoplay only while visible, no loop, two-second hold on the final frame, and a still poster with an explicit Play control when reduced motion is preferred.
- Use the existing page-level “Clips show sample data.” disclosure, as requested, without adding a second disclosure beside the recreated phone clip.
- Make the staged Claude interface recognizably faithful to the current Claude mobile experience while keeping the sequence clearly within the sample-data framing and avoiding unsupported product claims.

## Video production

- Inspect and prepare the uploaded clip without changing its content.
- Create the second clip as a scripted motion piece rather than pretending it is a recording of a live integration.
- Choreograph readable conversation turns, typed input, a thinking state, visible Lasso connector use, and the final confirmation.
- Produce a poster from each clip’s last frame so the two-second hold and reduced-motion state match what was shown.
- Keep text large enough to read at the carousel’s rendered size and verify the final media dimensions and duration.

## Current controls and states

**Before**
- Source-finding panel: one passive clip.
- Automatic visible-only playback, pause when not selected, final-frame hold, and restart.
- Reduced-motion state: poster plus “Play clip”.
- Loading state: poster while media loads.
- No custom error or empty state.
- No click event on the clip itself.

**After**
- Source-finding panel: two passive clips in one composed media area.
- Each keeps automatic visible-only playback, pause arbitration, final-frame hold, and restart.
- Each keeps the same reduced-motion, loading, error, and empty-state behavior.
- Each keeps the existing “Play clip” control under reduced motion.
- No existing control or state elsewhere on the landing page changes.

## Data impact

- This changes a public landing-page surface but adds no new data input or new custom user action.
- Existing surface coverage remains `landing.viewed` with payload `{ variant: "b2b", surface }`.
- Existing landing actions remain unchanged:
  - `landing.pilot_cta_clicked` with `{ location }`
  - `landing.see_it_work_clicked` with `{ location: "hero" }`
  - `landing.pilot_requested` with `{ team_size }`
- No event name, payload, or dimension changes.
- Nothing consent-related is touched.
- No database work.

## Files and verification

- Add the uploaded and generated media through the project asset flow, plus their poster frames.
- Update the B2B landing media composition and only the styles required for the paired layout.
- Update the landing test pins from the old single clip to the two new clip references while preserving all copy and control assertions.
- Verify focused landing tests, type checking, build status, media metadata, and desktop/mobile rendering.

This is a small redesign of the panel’s media hierarchy, not a skin, because one media slot becomes a coordinated two-video sequence. No page copy, navigation, forms, or business logic will change.
