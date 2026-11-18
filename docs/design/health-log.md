# Design health log

One record of the design-health programme, from the audit on 16 Nov 2026 to now. Add a row for every design PR in the same change. The live counts are in `src/design/design-health.json`, enforced by `design-health.test.ts`.

Goal (Liam, 17 Nov): "as design healthy as can be and durable for switching things". A reskin should mean changing a handful of token values in one place, and no new code should bring the debt back.

## How it started

| Date | Where | What |
|---|---|---|
| 16 Nov | Cloud session "Lasso code run designer workbench" (design-system-from-code skill) | Read-only audit of `lasso-by-charlotte-labs` at `26a4e1b`. Published the Lasso Design Workbench page (claude.ai/artifact/LV2sLupGcjEecxQwc8Wq2c) with 13 gaps, G1 to G13, tagged Now (hurts users today), Look (blocks a new look) or Upkeep (costs the team time). |
| 16 Nov | #160 | The brand flip: Charlotte is the only live skin. Lasso values remain as the fallback. |
| 16 to 17 Nov | Cloud session "Lasso - design - structure" | Built A1 (audit G5) and C1 part 1 (G1). Could not push; handed both to the laptop session as patches. |
| 17 Nov | Laptop session "Design gaps" | Pushed the hand-off, then worked through the list below. |

## Gaps

| Gap | Tag | What | Status | PRs |
|---|---|---|---|---|
| G1 | Look | Job-name colour tokens read by nothing | In-app CSS done; TS reads open | #162, #164, #176, #177 |
| G2 | Look | Three colour systems (`--nb-*`, new tokens, shadcn) | Shared blocks carry the mapping and derived tokens to shell and overlays; Charlotte overrides 230 to 110 | #162, #177, #190, #191, G2.3 PR |
| G3 | Look | No type scale (48 sizes) | Done for app surfaces | #166, #172, #173, #174, #175 |
| G4 | Now | Text below 10px | Done: nothing in the app below 11px | #167 |
| G5 | Now | Muted text fails AA | Done | #161 |
| G6 | Now | Lime and acid rings below 3:1 | Charlotte passes (paperclip is the second cue); guarded by a test | #186 |
| G7 | Look | App Button drifts from reference | Component done; raw `<button>` sweep open | #163 |
| G8 | Look | Radius: 3 tokens, about 18 values | Done for app surfaces | #188, #189 |
| G9 | Upkeep | styles.css size, literal z-index, `!important` | Open | |
| G10 | Upkeep | Reference components copied, not checked | Open | |
| G11 | Look | Hex colours in components | Open | |
| G12 | Upkeep | Dead dark theme | Removed | #186 |
| G13 | Upkeep | Raw spacing and inline styles | Open | |

## Design PRs, in merge order

| PR | Gap | Change | On screen |
|---|---|---|---|
| #161 | G5 | Muted text passes WCAG AA in both skins | Muted text slightly darker |
| #162 | G1 | 20 reads move onto `--state-on-record` and `--live` | No |
| #163 | G7 | App Button: 5px corners, flat Ember primary | Buttons 1px less round, no inner shadow |
| #164 | G1 | 13 in-app focus outlines read `--focus-ring` | No |
| #166 | G3 | Seven `--type-*` sizes from an 11px floor (option B) | No |
| #167 | G4 | 331 sizes from 8 to 10.5px lifted to 11px | Small labels grow 0.5 to 3px |
| #172 | G3 | All work page reads the type scale | Title +1px, chips +0.5px |
| #173 | G3 | 917 on-scale sizes read their names | No (pixel-identical) |
| #174 | G3 | 48 off-scale CSS sizes snap to the scale (app surfaces) | Slightly larger headings on settings, share, sources |
| #175 | G3 | 70 off-scale Tailwind sizes snap to the scale | Small shifts on plans, home, Ask |
| #176 | G1 | Selection is one navy outline; lime stays for Ask | Section titles and selected text blocks |
| #177 | G1, G2 | `--active-mark`, `--drop-target`, `--handle`, `--ai-voice` | No (pixel-identical) |
| #186 | G12, G6 | Dead `.dark` theme removed; Charlotte state cues pass 1.4.11, paperclip guarded | No (pixel-identical) |
| #187 | All | Design health ratchet and this log | No |
| #188 | G8 | Corner roles `--corner-*`; every older radius name points at them; 89 exact values read a role | No (values identical) |
| #190 | G2 | The app shell's older-name and job-token blocks cover overlays; Charlotte drops 24 duplicates | No (Charlotte unchanged; Lasso overlays now match the Lasso app) |
| #191 | G2 | 45 derived tokens re-resolve on shell and overlays; Charlotte drops 46 restated lines | No (Charlotte unchanged) |
| G2.3 PR | G2 | Skin base: region, board-hue and kind colours derive from six type hues for any skin | No (Charlotte unchanged) |
| #189 | G8 | Controls join the button at 5px; new float role 15px; long tail snaps; raw-radius count fixed to literal lengths only | Controls 1px less round; floating panels and menus settle on 15px |

Every PR was checked against main with the full test suite, lint, and the design-baseline screenshots (26 screens, Charlotte, desktop and phone), and has a row in `DESIGN-DECISIONS.md`.

## Health counts

Charlotte skin size (custom properties it declares): 230 on 17 Nov, 160 after G2 part 2, 110 after G2 part 3. The audit's target for a skin is about 20.


| Count | 17 Nov baseline (7e13e65d) | Now |
|---|---|---|
| Raw font sizes | 249 | 249 |
| Raw radii | 437 | 15 (counting rule corrected in R2: `rounded-[var(--x)]` no longer counted) |
| Hex in components | 76 | 76 |
| `var(--nb-*)` uses | 1653 | 1559 (rule corrected in G2 part 2: token declarations no longer counted) |
| Literal z-index | 183 | 183 |
| `!important` | 215 | 215 |

The audit's own 16 Nov figures used a different counting script: 810 raw font sizes, 1,828 `--nb-*` reads.

## Left on purpose

- Tour, demo, landing and onboarding type: fixed-height layouts clip when type grows (seen in #174). The tour is hidden from users for now.
- Sizes above 28px (headlines) and under 8px (miniature thumbnails).
- `src/design/reference`: mirrored byte for byte in Magic Patterns, so changes need that copy updated too.

## Open checks

- **PostHog:** event names and calls are untouched by every design PR. Actions, heatmap filters or toolbar actions defined by CSS class could break, because class strings changed (for example `text-[11px]` to `text-(length:--type-label)`). Audit those selectors later.
