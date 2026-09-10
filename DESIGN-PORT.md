# Design port: Figma to code

## What this is and when it is done

The live app at `lasso.charlotte-labs.com` is being redesigned to match the Figma
file screen by screen. That is the whole job. Every route in this document ends up
looking like its frame.

**Done means users see it.** Not committed, not in preview, not merged. A change
that has not been deployed to production has not happened, because the people the
redesign is for cannot see it. Report three states every time, and never collapse
them: `committed` / `in preview` / `published`. Preview rebuilds on commit;
production requires an explicit deploy and an explicit founder yes.

There are three Figma files with three different jobs. Do not confuse them:

| File | Job |
|---|---|
| Lasso · App Design System | **The target.** What ships. Tied to real routes and real data. Written with discipline. This document maps that file. |
| Lasso Design Explorations | **The mirror.** An automated 13:00 UTC job regenerates it from the live app, so it always shows what users currently have. It is an output, never an input. |
| Lasso · Sandbox A / B | **The sketchbook.** Dead ends allowed. Never port from it. |

The mirror is the reason production matters more than preview here. If the redesign
sits in preview, the next mirror sync still shows the old app, because the mirror
tracks what is live. Shipping to production is what makes the mirror, the design
file and the real product finally agree.

**What this is not:** a rebuild, a refactor, or a chance to improve the data layer.
The data layer does not move. See project knowledge rules 6 and 7.

Source of truth for what the app should look like: Figma file `SBM4zsmUiGrLH9rT7sTHa2`,
"Lasso · App Design System". This file maps that design to this codebase and tracks
what has actually been built.

Read this before restyling any screen. The binding rules are in project knowledge,
rules 6 to 14.

## How to use this file

When you finish work on a route, UPDATE ITS STATUS ROW in this file in the same commit.
That is part of the job, not an extra.

Status values, and they mean exactly this:
- `NOT STARTED` — no port work has happened.
- `BUILT` — code was changed to match the frame. NOT confirmed correct.
- `VERIFIED` — a human compared the rendered page to the frame and they match.

`BUILT` is not `VERIFIED`. Nothing here has ever been verified. In September 2026 the
sidebar sat at `BUILT` for a month while rendering the wrong font, the wrong active
state and a retired blue palette, because a build report was mistaken for a check.
Never promote a row to `VERIFIED` yourself.

## Figma pages

| Page | Node | Contents |
|---|---|---|
| 00 · Read me | — | The re-skin contract. Its BUILD ORDER checklist is STALE, do not treat it as state. |
| 01 · Screen inventory | — | Frame to route map, real field names, real states. |
| 02 · Variables | — | Token definitions. See project knowledge rule 10. |
| 03 · Library · Atoms | `1:4` | Button, Icon, Avatar, Mark. |
| 04 · Library · Surfaces | `1:5` | Cards and surfaces. |
| 05 · Library · Chrome | `1:6` | Sidebar, PageHeader, Tabs, Composer, MobileTabBar. |
| 06 · Motion registry | `1:7` | 22 events to 15 motions. Frame `18:2`. |
| 07 · Screens · Worker | `1:8` | 17 frames. |
| 08 · Screens · Coach | `1:9` | 2 frames. |
| 09 · Screens · Entry & settings | `1:10` | 11 frames. |
| 11 · States | — | Empty, one, many, long-text, error, loading. |
| 14 · Archive | — | Dead ends. Never port from here. |

NOTE: `get_metadata` with no nodeId returns only the read-me page on this file. Always
pass a page node id.

## Foundation layers

| Layer | Status | Notes |
|---|---|---|
| Tokens / variables | PARTIAL | Values exist in `src/styles.css` but have never been diffed against Figma in full. |
| Motion registry | NOT STARTED | Zero of 22 events implemented. This is the single largest gap. |
| Atoms | PARTIAL | `GraphiteIcon` is complete and correct. Button reviewed. |
| Surfaces | PARTIAL | `ToneCard`, `SectionHeader` exist. |
| Chrome | BUILT, KNOWN DIVERGENT | See the sidebar note below. |

### Sidebar, known divergences as of 10 Sep 2026
Structure is correct and `SidebarNav` follows `nav-config.ts` as designed. Four things
do not match frame `12:2`:
1. `.nb-group-header` renders bold sans. Figma is Caveat Bold 16px at `text/primary`.
2. `.nb-nav-item-active` is blue-bordered. Figma is a white card with a 1.2px
   `action/secondary-border` edge, the same object as the primary button.
3. `.nb-nav-shelf` renders client shelves in blue, the last of the retired palette.
4. `LassoLogo` renders the mascot. Frame `12:2` uses a drawn green loop mark.
Also absent: the `spider.reading` status line above the footer rule.

## Worker routes — page 07, node `1:8`

| Frame | Route | Status |
|---|---|---|
| `21:2` | `/overview` | BUILT |
| `22:220` | `/work` | BUILT |
| `23:413` | `/firm` | BUILT |
| `27:635` | `/ai-record` | BUILT |
| `29:833` | `/archive` | BUILT |
| `30:1012` | `/reflect` | BUILT |
| `30:1419` | `/decisions` | BUILT |
| `32:1323` | `/one-on-one` | BUILT |
| `32:1709` | `/coach-notes` | BUILT |
| `34:1632` | `/connectors` | BUILT |
| `34:2043` | `/members` | BUILT |
| `36:1936` | `/engagements/$id` (arrival, strip expanded) | BUILT |
| `36:2272` | `/engagements/$id` (asking, strip collapsed) | BUILT |
| `49:2354` | `/classes` (EDU) | NOT STARTED |
| `49:2573` | `/assignments` (EDU) | NOT STARTED |
| `49:3044` | `/projects` (EDU) | NOT STARTED |
| `49:3375` | `/portfolio` (EDU) | NOT STARTED |

## Coach routes — page 08, node `1:9`

| Frame | Route | Status |
|---|---|---|
| `39:487` | `/coaching` | BUILT |
| `39:980` | `/coaching/$engagementId/$subjectId` | BUILT |

Frame `39:980` contains a panel stating the exact number of items a subject withheld.
That contradicts `src/lib/coaching-access.ts` ("Nobody is told when you keep something
back"). It was deliberately NOT built. Do not add it.

## Entry and settings — page 09, node `1:10`

| Frame | Route | Status |
|---|---|---|
| `40:487` | `/` (landing) | NOT STARTED — build LAST, founder rule |
| `40:760` | `/auth` | BUILT |
| `40:813` | `/join` | NOT STARTED |
| `40:933` | `/join/edu` | NOT STARTED |
| `40:1053` | `/no-access` | NOT STARTED |
| `43:511` | `/onboarding` | BLOCKED — see below |
| `43:1019` | Settings dialog | BUILT |
| `47:669` | `/trust` | NOT STARTED |
| `47:1006` | `/why` | NOT STARTED |
| `47:1125` | `/how-lasso-works` | NOT STARTED |
| `66:678` | Error state | NOT STARTED |

### `/onboarding` is blocked
1. `onboarding.tools_selected` fires ONLY on the tools-stage Continue, which also calls
   `saveToolsUsed(picked)`. The Figma collapses tools and capture into one screen.
   Doing that kills the event AND `tools_used` is never written. The two stages must
   stay two.
2. The frame is a left-aligned 600px column; production is a centred `max-w-3xl`.
   That is a layout change, which the skin rule forbids. Needs a founder decision.

### `/no-access`, the frame is wrong
Frame `40:1053` draws a forbidden-resource state ("This page belongs to an engagement
you are not on"). The real `/no-access` is the no-workspace-membership state. Shipping
the frame's copy would tell a user with no workspace that they are viewing someone
else's engagement, and its "Back to your work" button would loop them into the redirect
that sent them there. Take the visual treatment, keep the true copy.

## Standing hazards

- `/auth` and `/onboarding` both carry `ssr: false`, which causes a hydration mismatch
  the client silently recovers from. A restyle CANNOT fix it: `ssr` sits in the same
  options object as `beforeLoad`, inside the routes-never-change fence. Needs its own pass.
- Six test files are red and predate the port. Only `pass83-tokens` has been verified as
  a stale test. The other five were inferred from shape, not investigated:
  `pass146-branded-emails`, `pass143-invite-signup`, `pass93`, `pass84`, and the trio
  `pass94` / `pass115` / `pass133-1`.
- Filter chips shipped on `/work`, `/decisions` and `/ai-record` with no covering
  telemetry event, then were correctly REFUSED on `/archive` for that same reason.
  Unresolved inconsistency. Either those three need coverage or view-state filters do
  not count as tracked actions. Founder decision.
