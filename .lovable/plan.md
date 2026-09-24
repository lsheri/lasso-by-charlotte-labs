# Landing page mobile and scroll-video pass

## Data impact

- **User action / flow:** Changes how the three existing product clips start. They will begin automatically from scrolling into the section, one at a time, instead of requiring pointer hover or tap.
- **Event coverage:** Keep `landing.usecase_played` and its existing `{ card, input_mode }` payload. Add the additive `input_mode: "scroll"` value for automatic starts; preserve the existing card keys and once-per-card-per-page-view guard.
- **Portal dependency:** The separate data portal must add support for the new `scroll` value before this ships. No event name, key, or existing value changes.
- **Consent:** No consent surfaces, consent stamping, or consent logic change.
- **Storage:** No database, SQL, schema, migration, or data edits.

## Build

### 1. Scroll-led product clips

- Replace hover-only startup with a shared section coordinator so only one product clip can play at any moment.
- On desktop, when the product section enters view, play the three clips in order. Advance when the current clip ends; after the third clip, stop on its final frame rather than creating competing loops.
- On phone, use viewport position to activate the card nearest the reading focus, pausing the previous card immediately as the next takes over.
- Pause playback when the section leaves view or the browser tab is hidden, and resume the current eligible clip when it returns.
- Respect reduced-motion by leaving posters still and retaining explicit tap-to-play controls.
- Retain tap/click as an accessible manual fallback. A manual start pauses every other clip.
- Keep WebM/MP4 sources, posters, failure fallback, muted inline playback, and CDN resolution unchanged.

### 2. Full phone-layout pass

Optimize the existing landing hierarchy without changing claims or adding sections:

- **Header:** prevent the brand, sign-in action, and pilot action from crowding; keep all navigation destinations and the sticky pilot action.
- **Opening section:** rebalance heading and supporting-copy sizes, line lengths, spacing, and calls to action so the first screen reads cleanly at 320–430px widths.
- **Hero clip:** preserve its full-bleed 2:1 treatment, caption, reduced-motion play control, and edge fade while ensuring no clipping.
- **Walkthrough:** refine phone spacing and scale for role labels, questions, answers, source rows, and embedded slides; retain all four active/inactive states and nearest-to-centre selection.
- **Product clips:** use a comfortable single-column rhythm, stable 16:9 frames, clear active state, and touch-sized controls.
- **Sharing, closing section, pilot form, and footer:** improve line lengths, vertical rhythm, grid collapse, field sizing, and link wrapping without changing wording or order.
- Use existing semantic tokens only. Preserve the current lime restrictions and all reduced-motion behavior.

## Control and state contract

### Before

**Controls:** header brand link; Why Lasso; Trust & data; Sign in; header Book a pilot; hero Book a pilot; See it work; Start your own record; three product-video buttons; closing Book a pilot; pilot fields for name, firm, work email, team size, note, and hidden website field; pilot submit; email and footer links.

**States:** hero autoplay or reduced-motion poster/play; four walkthrough active/inactive steps; desktop sticky deck and phone embedded slides; visible/hidden word stream; each product clip poster/loading/playing/paused/ended/error; close concealed/resolved; pilot idle/submitting/success/error; section and tab visibility.

**Events:**
- `landing.viewed` with `{ variant: "b2b", surface }`
- `landing.story_section_viewed` with `{ section, input_mode: "scroll" }`
- `landing.usecase_played` with `{ card, input_mode }`, currently `hover | tap`
- `landing.pilot_cta_clicked` with `{ location }` or `{ placement }`
- `landing.see_it_work_clicked` with `{ location: "hero" }`
- `landing.pilot_requested` with `{ team_size }`

### After

- The control list remains identical.
- The state list remains identical, with one added playback trigger state: scroll-selected product clip.
- Event names and keys remain identical. `landing.usecase_played.input_mode` becomes `hover | tap | scroll`; `scroll` covers automatic starts. Existing values remain accepted.

## Verification

- Add focused tests for one-at-a-time playback, desktop sequence, phone viewport selection, section exit, tab visibility, reduced motion, manual fallback, failure fallback, and once-per-card event emission.
- Verify at 1440×900, 390×844, and a narrow 320px phone width.
- Confirm only one video is playing at every checkpoint and each automatic first play emits `landing.usecase_played` once with `input_mode: "scroll"`.
- Exercise header links, walkthrough steps, closing reveal, pilot form states, and footer links on phone.
- Check for horizontal overflow, clipped text, overlapping controls, undersized touch targets, runtime errors, and layout shifts.
- Keep the work preview-only and do not publish.

## Files

- `src/components/marketing/B2BLanding.tsx`: coordinated playback, retained controls, additive event value.
- `src/styles.css`: landing-only phone refinements and active-video presentation.
- `src/lib/__tests__/u4-landing-beats.test.ts` and relevant event tests: playback and additive event assertions.
- `roadmap.md`: record and complete this landing unit.
