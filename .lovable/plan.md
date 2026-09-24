# Landing story emphasis, sticky pacing, mobile, and lime brand mark

## Data impact and gates
- Presentation-only update to the public landing and shared static Lasso loop mark.
- No database, consent, authenticated-data, route, or product-permission changes.
- No new user actions. Keep the existing controls and handlers exactly as they are.
- Keep event names and payloads unchanged. This work continues using:
  - `landing.viewed` with `{ variant: "b2b", surface }`
  - `landing.pilot_cta_clicked` with `{ location }`
  - `landing.see_it_work_clicked` with `{ location: "hero" }`
  - `landing.pilot_requested` with `{ team_size }`
  - `landing.story_section_viewed` with `{ section, input_mode }`
- The previously added `landing.story_section_viewed` still requires its matching portal-side update before release.

## What will change

### 1. Make the question and answer the visual payoff
- Recompose the right side of the source-to-deck story into an unmistakable two-part exchange:
  - an incoming prompt labeled clearly as coming from a client or manager;
  - a large, high-contrast question;
  - a distinct Lasso answer beneath it with the source cue kept visible.
- Use the reference recording’s kinetic principle: one bold object arrives, holds, and resolves. The question will enter decisively, then the answer and source line will reveal in sequence.
- Keep all four existing questions and answers, including the Claude “xyz” request. Do not invent proof, claims, or customer figures.
- Preserve the four slide selectors, source cards, deck, vendor marks, and existing active-slide behavior.
- Give reduced-motion visitors the same complete question, answer, and source information without movement.

### 2. Keep “How it works” present and remove the blank-scroll feeling
- Make the “HOW IT WORKS” label and title part of the desktop pinned composition rather than a heading that scrolls away before the steps finish.
- Reduce the oversized per-step vertical reserve and align each step transition to the pinned visual, so the next idea arrives without a large empty field.
- Keep the current scroll-led section selection and `landing.story_section_viewed` emission semantics unchanged.
- Keep the hero headline and looping lime highlight exactly as approved.

### 3. Recompose for mobile, not merely shrink desktop
- On phones, render each of the four ideas as a compact sequence: step title, relevant source/deck state, then the clearly paired question and answer.
- Keep text readable, controls at comfortable touch size, and the four slide selectors available without horizontal overflow.
- Avoid sticky behavior on mobile; use short reveal transitions and a complete static reduced-motion state.
- Verify common phone widths and the current desktop viewport with no clipping, hidden questions, or document-width overflow.

### 4. Use the glyph-motion lime for the static Lasso loop everywhere
- Add a semantic logo-color utility mapped to the existing `--nb-lasso-green` token. Do not repoint the general green token, because it also colors unrelated product states.
- Apply that lime to every static `LassoLoopMark` use: public header, sign-in lockup, desktop app menu, mobile app header, board rail, landing ornament, Ask Lasso reply mark, and Find it link mark.
- Add the loop mark beside the existing mobile `LASSO` word so mobile and desktop product menus carry the same identity.
- Leave the separate raster mascot artwork unchanged; this request targets the static loop glyph shown in the supplied landing reference.

## Control and state contract

### Before
- Controls: home logo link; Why Lasso; Trust & data; Sign in; hero Book a pilot; See it work; Start your own record; four deck slide tabs; pilot name, firm, email, team-size, note, hidden anti-spam field, submit; email link; footer Why Lasso, Trust & data, For individuals, Sign in, company-site and LinkedIn links.
- States: four active story/deck states; in-view animation running or paused; reduced motion; desktop pinned story; mobile stacked story; pilot form idle, sending, success, and error.

### After
- The same controls, handlers, destinations, events, payloads, and states remain reachable.
- The only addition is a non-interactive lime loop beside the existing mobile product wordmark.
- No control is removed, renamed, or stranded.

## Files
- `src/components/marketing/HeroMotion.tsx`: strengthen the client/manager question and Lasso answer composition while preserving the four-slide contract.
- `src/components/marketing/B2BLanding.tsx`: keep the section heading with the pinned desktop experience and preserve the existing observer, handlers, form, and event calls.
- `src/styles.css`: add the semantic lime logo token; revise question/answer motion, sticky geometry, density, mobile composition, and reduced-motion rules.
- `src/components/layout/BrandLockup.tsx`, `PublicHeader.tsx`, `AppSidebar.tsx`, `AppShell.tsx`, plus existing static loop call sites: apply the shared lime mark without changing behavior.
- Landing and mark tests: update exact class expectations and add guards for visible question/answer pairing, sticky heading presence, mobile composition, and shared lime usage.

## Verification
- Re-run the focused landing, mark, motion, and locked regression checks; then the full relevant test group and type safety.
- Confirm the preview build is clean.
- Signed-out browser checks at the current 1542×1075 viewport and representative phone sizes:
  - headline highlight remains correct;
  - “How it works” remains visible through all four desktop steps;
  - each question, answer, and source cue is immediately legible;
  - slide controls still change the story;
  - no large blank scroll regions or horizontal overflow;
  - static loop marks are the same lime on home, sign-in, desktop menu, mobile menu, and board shell;
  - no console or runtime errors.
