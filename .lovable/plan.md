# Unit L1: scroll-driven demo board landing

## Data impact
- New public surface: `landing.viewed` with `variant: "b2b"` and `surface: "landing-board"`.
- Section visibility continues `landing.story_section_viewed`, adding the ten step keys and `scroll | jump` input modes.
- Section buttons add `landing.section_jumped { section }`.
- Pilot links continue `landing.pilot_cta_clicked { placement }`.
- Consent and database behavior are untouched. Portal rows are architect-owned.

## Build
1. Add a public, noindex `/landing-board` route with no identity redirect or navigation link.
2. Load only the public-safe YSM-01 demo board and saved presets through `openDemoBoardFn`.
3. Build a ten-step sticky stage whose single board layer changes camera and story state from scroll or section jumps, with a non-animated reduced-motion path.
4. Reuse the Home signature mark and landing particle phrase, then continue into shared landing closing sections without changing `/`.
5. Add closed event dimensions, focused tests, and desktop/phone browser checks for steps 1, 4, 6, and 7.

## Control and state inventory
**Before:** no controls or states on this new route.

**After controls:** ten section jump buttons; Watch it work; four Book a pilot links; Open the board yourself; pilot form fields and submit; existing footer links.

**After states:** board loading; unavailable; ten reversible scroll states; tool cards arriving; grouped workstreams; deliverable; circled figure; saved-answer panel; exact-turn reader; open notes; share dialog; pilot form idle, sending, success, and error; reduced motion; desktop and phone layouts.

**Events:** `landing.viewed { variant, surface }`; `landing.story_section_viewed { section, input_mode }`; `landing.section_jumped { section }`; `landing.pilot_cta_clicked { placement }`; `landing.pilot_requested { team_size }`; existing use-case playback events in the continuation.
