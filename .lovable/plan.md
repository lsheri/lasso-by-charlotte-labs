# Landing hero spacing fix

Two spacing changes on the desktop landing hero, per the annotated screenshots.

## Changes (src/styles.css only, all inside `@media (min-width: 640px)`)

1. **2 inches between header and title**
   - `.lb-desktop-hero .lb-hero-copy` currently sits `top: 12px` below the header (line 6110).
   - Change to `top: 192px` (2 inches) so "Your firm bought AI." starts well clear of the header.

2. **1 inch between the CTA buttons and the board animation**
   - `.lb-hero-assemble` currently has `margin: 20px auto 0` (line 6117).
   - Change top margin to `96px` (1 inch).

## Constraints honored

- Desktop only: both rules already live inside `@media (min-width: 640px)`; phone view (`.lb-phone-hero`, PhoneStory) untouched.
- No changes to the h1, LandingParticlePhrase, subline, buttons, or any component file. CSS only, no shared token/font/component edits.

## Risk to flag

The hero is `height: calc(100vh - header)` with `overflow: hidden`. Pushing the copy down 192px plus 96px before the board adds ~268px of vertical space. At your viewport (1587x1090) the hero is ~1026px tall, so the board and caption should still fit. On shorter screens (e.g. 1372x732, hero ~668px) the board animation and caption will be pushed partly or fully below the fold and clipped. I will verify at 1587x1090, 1372x732 and 390x844 and report what is visible at each size; if the board is fully clipped at short heights I will report it rather than shrink anything.

## Verification

- Playwright screenshots at 1587x1090, 1372x732 and 390x844 (phone must be unchanged).
- Confirm computed `top` = 192px on the copy block and `margin-top` = 96px on the assemble plane.
- Build check via /tmp/observability/build-errors.log.

## Data impact

None. Pure spacing change: no new user action, surface or flow; no telemetry events added or changed; nothing consent-related; no database work.
