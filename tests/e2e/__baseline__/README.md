# Design baseline

The "before" pictures every later design change is compared against. Made by
`tests/e2e/design-baseline.spec.ts`; see its header for how to run it.

## State (13 Nov 2026)

Partial baseline, Lasso skin, taken from a local dev server at this branch.
Two runs of the same commit produce identical pictures.

| Surface | desktop-1280 | phone-375 |
|---|---|---|
| 01 landing | captured | captured |
| 02 sign-in | captured | captured |
| 03 plans | captured | captured |
| 04 onboarding tour | captured | captured |
| 05 home | pending | pending |
| 06 all work | pending | pending |
| 07 sidebar open | pending | not on phone |
| 08 board and toolbar | pending | pending |
| 09 Ask, idle | pending | pending |
| 10 Ask, thinking | pending | pending |
| 11 share dialog | pending | pending |
| 12 settings | pending | pending |
| 13 sources | pending | pending |
| 14 mobile tab bar | not on desktop | pending |

Pending surfaces need a signed-in QA account. They are added by rerunning the
spec once one is available; the spec needs no change for that.

The landing picture is the first frame of the hero video at the top of the page.
