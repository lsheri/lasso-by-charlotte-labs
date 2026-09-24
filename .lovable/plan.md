# Landing "How it works": five sources, bigger Q&A, vortex reaches the answer

Landing-only change (`/` hero story). No app, database, consent or event changes.

## What changes

1. **Two new source cards on the left**
   - Granola, labelled as a meeting transcript (e.g. "Granola · 3 Sep · Client call transcript"), using the real Granola logo already in the project (connector brand mark) instead of the current "G" placeholder.
   - Lovable (e.g. "Lovable · 12 Sep · Prototype build"), using the Lovable logo already in the project.
   - Excerpts stay illustrative and tied to the same case; no new claims.
   - Five cards stack tighter so the column does not grow taller. Mobile still shows only the active source.

2. **Q&A becomes the largest part of the composition**
   - Grid rebalanced: sources narrow, deck shrinks to a supporting size, question/answer column widest.
   - Question set larger in Instrument Serif; answer copy larger with the source path clearly visible.

3. **Vortex flows all the way into the answer**
   - The lime tunnel and excerpt fragments extend past the deck and land in the answer box.
   - Five fragments (Claude, ChatGPT, Gemini, Granola, Lovable), each with its logo.
   - The answer text "fills in" as fragments arrive (word-by-word reveal timed to the flow), replaying on each slide change.
   - Reduced motion: static tunnel, answer shown in full immediately.

4. **Hand-drawn graphite circle around the Q&A**
   - Inline SVG loose pencil ellipse (graphite line token, pencil stroke), slightly imperfect, drawn in once per slide change with a stroke-dash animation. Static under reduced motion.

## Data impact
- No new user actions, so no new events. Existing five landing events unchanged (including `landing.story_section_viewed`).
- No consent, SQL or event schema changes. Copy checked against the language rules.

## Technical details
- `HeroMotion.tsx`: add `granola` and `lovable` to `SOURCES` and tunnel fragments; render Granola via `BrandLogo`, Lovable via `VendorMark`; wrap answer in a relative container with a `landing-story-doodle` SVG; split answer copy into spans with staggered delays.
- `styles.css`: new grid columns (roughly sources 0.8fr / deck 1fr / Q&A 1.4fr), extend vortex streams and fragment keyframes to the answer column, doodle draw keyframe, word-reveal keyframe, mobile and reduced-motion variants. Tokens only, bracket-form tracking only.
- `u4-landing-beats.test.ts`: assert five sources and doodle presence.
- Verify at 1542x1075 and 390x844 with no overflow.
