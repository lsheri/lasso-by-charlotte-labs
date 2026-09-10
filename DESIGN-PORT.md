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
| 03 · Library · Atoms | `1:4` | Button, Icon, Avatar, Mark, Chip, Counter, StatusChip, Field, plus a 34-logo attribution-mark board. |
| 04 · Library · Surfaces | `1:5` | Cards and surfaces. |
| 05 · Library · Chrome | `1:6` | Sidebar, PageHeader, Tabs, Composer, MobileTabBar. |
| 06 · Motion registry | `1:7` | 22 events to 15 motions. Frame `18:2`. |
| 07 · Screens · Worker | `1:8` | 17 frames. |
| 08 · Screens · Coach | `1:9` | 2 frames. |
| 09 · Screens · Entry & settings | `1:10` | 11 frames. |
| 10 · Artifact viewer | — | 4 frames, component-level not route-level. V1 peek panel, V2 what fed this, V3 Work Artifact, V4 circling a region (PROPOSED, refused). |
| 11 · States | — | Empty, one, many, long-text, error, loading. Frames A/B/C BUILT (skin only); D/E/F not ported, they require new actions, computed counts or new verdict vocabulary. |
| 13 · Marketing | — | 6 frames. Marketing collateral and one shipped email, not routes. See the Marketing section below. |
| 14 · Archive | — | Dead ends. Never port from here. |

NOTE: `get_metadata` with no nodeId returns only the read-me page on this file. Always
pass a page node id.

## Foundation layers

| Layer | Status | Notes |
|---|---|---|
| Tokens / variables | PARTIAL | Values exist in `src/styles.css` but have never been diffed against Figma in full. |
| Motion registry | BUILT (registry + hook, 10 Sep 2026) | Page `1:7`, frame `18:2`, is documentation, not a route. Built: `src/lib/motion-registry.ts` holds the event to motion table with 20 event names, their reduced-motion answers and a `promise` flag on the five auditability events; `src/hooks/use-motion.ts` exposes `useReducedMotion` / `useMotion`; `prefersReducedMotion()` now backs the inline `matchMedia` reads in `ProvenanceAudit.tsx` and `UpstreamPane.tsx`. No new motion tokens were needed: `--nb-dur-*` and `--nb-ease` already exist in `styles.css`, so that file was not touched. No visual change and no control change on this pass; existing surfaces still draw their own motion until each is migrated event by event. EXCLUDED: the landing hero event is marketing-only and frozen under rule 15, so it is absent from the map and must never be added; `region.circled` is PROPOSED with no surface behind it; `spider.reading` is held because its reduced-motion copy states a count the product cannot produce (rule 9) - use 'Reading new conversations'; `page.enter` must never be wired above the signed-in shell, because that would reach `/`; `AskDock.tsx` is pinned literally by `pass95-1-dock.test.ts`. Figma keyframe values cannot be extracted from the frame, so durations stay on the existing tokens. |

## Motion — the goal, and the whole registry

Source: Figma page `06 · Motion registry`, node `1:7`, frame `18:2`.
**22 events, 15 motions, one table.** Zero of the 22 are built in this codebase today.

### Why motion is in scope at all

Motion here is not decoration and it is not polish added at the end. Two reasons it
is a first-class layer:

1. **Retention.** How an app feels is a large part of why people come back to it.
   That is a product goal, not an aesthetic preference.
2. **Evidence.** Five of these events are the only visible proof that Lasso is
   auditable, which is the thing a firm is actually buying. They say out loud what
   the software read and where a claim came from.

### The governing rule

> "A screen never picks an animation. It fires an event, and this table decides what
> plays."

A screen must never choose its own animation. It fires an event; the registry maps
that event to a motion. Changing the app's entire motion personality is then editing
one column, and a future skin can swap the mapping the way it swaps colour.

Every event has a reduced-motion answer that carries the same information without
moving. Reduced motion removes movement, never meaning.

### Auditability — never remove one of these. They are a promise, not decoration.

| Event | Fires when | Motion | Reduced motion | Where |
|---|---|---|---|---|
| `record.reading` | AiReads renders under a work item | Reading line | The list of what is read, stated in full | Peek panel, every work item, every chat |
| `verify.reading` | A fact-check pass runs | Reading line | Progress text naming the turn being read | Verify, long analyses |
| `verify.flagged` | A claim is marked worth a check | Pencil marks, underline | The underline appears, no draw | Verify, Work Artifact checks |
| `provenance.tracing` | What fed this is loading | Trace back | Sources appear as a list, newest last | Peek panel, engagement |
| `provenance.shown` | A receipt or journey is opened | Provenance ribbon | Static ribbon with the same words | Work Receipt, Journey |

> **Why this first table is different.** Those five say out loud what the software
> read and where a claim came from. Cutting them for performance or taste would
> remove the only visible evidence that Lasso is auditable, which is the thing a firm
> is buying. If reduced motion is on, the words stay and only the movement goes.

### The record moves

| Event | Fires when | Motion | Reduced motion | Where |
|---|---|---|---|---|
| `work.lands` | New work arrives from a connector or a drop | Work lands | Fade in, no drop | Work, Overview, Connectors |
| `work.piles` | Work list becomes a matrix | Paper physics, pile | Instant reflow | Work |
| `claim.lassoed` | You claim your part of a piece of work | The Lasso | A static outline appears | Work detail, claim gate |
| `record.stamped` | A call goes on the record, a receipt is issued | Stamp | The badge appears with its date | Your calls, receipts |
| `call.logged` | A decision is saved | Pencil marks, tick | The tick appears | Your calls, Decision log |
| `share.sending` | A receipt leaves for a coach | Comet line | Fade, then the confirmation toast | Share sheet |
| `feedback.pinned` | A coach note lands on a turn | Card lifts | Fade in | Work detail, coach loop |
| `region.circled` | PROPOSED. A region on a page is circled | The Lasso, overlay variant | Static outline on the region | Not built. See Figma page 10 |

### The app is thinking

| Event | Fires when | Motion | Reduced motion | Where |
|---|---|---|---|---|
| `ai.thinking` | A short reply is coming | Breathing dots | "Thinking…" | Ask Lasso composer |
| `ai.working` | A long analysis is running | Spider looks again | "Working…" with what it is doing | Ask Lasso, Reflect, analyses |
| `spider.reading` | Lasso is ingesting a conversation | Spider looks again | "Reading 3 new conversations" | Sidebar status, Connectors |
| `spider.guiding` | An onboarding beat changes | Spider processes | The spider holds still | Onboarding |
| `connector.connecting` | An OAuth handshake is in flight | Breathing dots | "Connecting…" | Connectors, settings |

### Chrome

| Event | Fires when | Motion | Reduced motion | Where |
|---|---|---|---|---|
| `page.enter` | A route changes | Card lifts, staggered | Content appears | Every screen |
| `nav.active` | A sidebar item is selected | Pencil marks | The active card appears | Sidebar, tabs |
| `arrow.drawn` | A connection between two things is shown | Arrows | Static arrows | Journey, flows, receipts |
| `hero.words` | A landing hero plays | Words pass by, or the word loop | Static line of words | **Marketing only, never in the app** |

### How to build this

Build the registry ONCE as an event-to-motion map, not per screen. A screen imports
the firing function and names an event; it never names an animation. Every screen
already ported inherits its motion the moment the registry exists.

Two things already in the codebase are part of this layer and must not be duplicated:
- `GraphiteIcon` in `src/components/notebook/icons.tsx` already carries per-icon
  signature animations with their own transform origins and `pathLength` trims. That
  is the "Pencil marks" family. Wire the registry to it rather than rebuilding it.
- The spider mascot exists at `src/assets/lasso-spider-static.png`. The three spider
  events animate that character, they do not invent a new one.

`spider.reading` is the handwritten green status line above the sidebar footer rule.
It is currently absent from the sidebar. It is not a missing feature, it is this
unbuilt event.

Keyframes, easing curves and durations are not in this document. Pull them per motion
from Figma with `get_motion_context` on node `1:7` at build time, so this file never
goes stale against the design.
| Atoms | BUILT | Avatar, Field and StatusChip skinned 10 Sep 2026; atoms tokens added to `styles.css`. HELD, needing a decision: Button primary fill (code is ember, Figma is graphite `--nb-ink-90`), Chip and Counter (no production mapping yet), the two icon glyphs that differ (`messages`, `decisions`), and the 34-logo attribution board against the smaller `BrandKey` set. `GraphiteIcon` is complete; the Figma icon set is a 13-name subset of its 24, not one-to-one. |
| Surfaces | BUILT (2 of 8) | Page `1:5` holds two boards, not one: Card, ListRow, SectionHeader, Panel, Modal, Toast, EmptyState, plus a separate SectionBand board. Skinned 10 Sep 2026: `ToneCard` record-tone micro label now `text/hand` green per frame; `SectionHeader` already matched, no change. NOT BUILT, and each is a redesign not a skin: `ListRow` (rows are inline in `WorkPage.renderGroup`, and carry a row menu, map button, group-count and peek target the frame does not draw — rule 8), `Panel`, `EmptyState` (copy inline across `WorkPage`, `CoachNotesPage`, `ConnectorPicker`, `ScopePicker`), `SectionBand` (blocked on the open Counter decision and introduces a collapse control with no covering event — rule 1). HELD: `Toast` — `sonner.tsx` is mounted in `__root.tsx` and therefore renders at `/`, so rule 15 blocks it; its frame `Undo` on all three tones is a rule 9 failure anyway. REFUSED: the `Modal` settings variant redraws route `/settings` as an 880x560 surface, which rule 7 forbids. Figma exports arrive with raw hex and Tailwind default colours (`bg-green-50`, `bg-red-50`, `bg-gray-100`); these fail `pass83-tokens` and must never be pasted in. |
| Chrome | BUILT (sidebar + phone tabs skinned 10 Sep 2026) | Page `1:6` holds Sidebar (Worker/Coach/Student), PageHeader, Tabs, Composer, MobileTabBar, Icon and nested Button. Skinned: `.nb-group-header` is now Caveat Bold 16px at `text/primary`; `.nb-nav-item-active` now carries a 1.2px `action/secondary-border` edge on the white card; the active phone tab now carries the green dot from frame `12:600`, drawn in CSS so it adds no control; `.nb-nav-shelf` is now `text/muted` (`--nb-soft`), matching Figma 12:332; the sidebar brand mark is now the drawn green loop `LassoLoopMark` while `LassoLogo` remains unchanged for other callers. HELD: `spider.reading` status line (unbuilt motion event, page `1:7`); Student sidebar role (no runtime role behind it); `PageHeader` action and breadcrumb variants (rule 7 redesign, and `PageHeader` has no action prop by contract). REFUSED: the Composer frame's `/ SKILLS` affordance does not exist in the product (rule 9), and `AskDock.tsx` is pinned literally by `pass95-1-dock.test.ts`. The Tabs frame draws an underlined tab strip; `StitchTabs` is a wrapping pill rail with a per-question menu, so restyling it to the frame is a redesign under rule 7, not done. |

### Sidebar, known divergences as of 10 Sep 2026
Structure is correct and `SidebarNav` follows `nav-config.ts` as designed. Against
frame `12:2`:
1. `.nb-group-header` — CLOSED 10 Sep 2026. Now Caveat Bold 16px at `text/primary`.
2. `.nb-nav-item-active` — CLOSED 10 Sep 2026. It was never blue-bordered in code (the
   note was stale); it is a white card and now carries the 1.2px
   `action/secondary-border` edge.
3. `.nb-nav-shelf` — CLOSED. Now `text/muted` (`--nb-soft`) per Figma 12:332;
   `pass92.test.ts` was updated to assert the muted token.
4. `LassoLogo` renders the mascot. Frame `12:2` uses a drawn green loop mark. CLOSED
   for the sidebar: `AppSidebar` now renders `LassoLoopMark` in green. `LassoLogo`
   remains untouched because `PublicHeader` on `/` is frozen under rule 15.
Also absent: the `spider.reading` status line above the footer rule.
Separately, `pass84-icons.test.tsx` asserts `.nb-nav-item-active::before`, which has
never existed in `styles.css`. That test failure predates this port and is untouched.

## Worker routes — page 07, node `1:8`

| Frame | Route | Status |
|---|---|---|
| `21:2` | `/overview` | BUILT | Added `ReadingPanel` and `NotCovered` panels (Figma 21:2), both read-only and non-interactive. |
| `22:220` | `/work` | BUILT (dense column cards, pass 1 of 2, 10 Sep 2026) |
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

Work page notes, 10 Sep 2026 (frame `22:220`, pass 1 of 2). The four columns now
match the frame's Documents, Models & sheets, Call transcripts and AI conversations
grouping. Column heads use mono stamps, counts and full-width hairlines. Work rows and
conversation cards use the frame's dense three-line presentation; all existing card
controls remain available on touch screens and reveal on hover or keyboard focus at
`md` and above. No action, handler, event, consent surface or route changed.

Engagement page notes, 10 Sep 2026 (frame `36:1936`). Added: hand-written breadcrumb
back to `/work` above the title; the engagement code / client / term trail follows
it so nothing is lost. The stat line (`EngagementStats`) now renders as quiet
body text instead of `page-subtitle`. Per-workstream relative fill bars show each
workstream's weight against the busiest one. Shipped cards are toned by whether the
deliverable appears in `shipped_work`: record green when shipped (meta reads source
count / "shipped to the firm"), claim yellow when not (meta reads "WAITING ON YOU ·
claim it or say not mine"). Per-workstream call counts are derived from decisions
citing that workstream's mapped items; shipped cards are stamped `TYPE · 02 SEP`;
the handwritten strip caption remains. Layout stays the frame's banded structure:
full-width strip below the header, horizontal workstreams and shipped cards, canvas
in the middle, 660px composer at the foot of the page. Read-only display only; no
control, hook order or telemetry changed.
| `49:2354` | `/classes` (EDU) | BUILT (skin, 10 Sep 2026) |
| `49:2573` | `/assignments` (EDU) | BUILT (skin, 10 Sep 2026) |
| `49:3044` | `/projects` (EDU) | BUILT (skin, 10 Sep 2026) |
| `49:3375` | `/portfolio` (EDU) | BUILT (skin, 10 Sep 2026) |

EDU skin notes, 10 Sep 2026. `/classes` and `/projects` share
`src/pages/EduEngagementsPage.tsx`, so the four frames are three files. Ported:
`ToneCard` paper surfaces, `SectionHeader` for the unsorted-rows question,
`section-title` on the assignment group link, `--nb-pencil` hairlines,
`--radius-control`, and body type at 13px / 11.5px. REFUSED under rule 9: the
Assignments frame's due-date column and completion count (neither field is read),
the Assignments per-row checkbox and the Classes term grouping (both redesigns
under rule 7), and any Portfolio sharing claim - `PORTFOLIO_PRIVACY_LINE` stands.
OPEN: these three screens fire no telemetry at all. Sorting an engagement into
class or project, and Portfolio promotion, are user actions with no covering
event. Same unresolved class as the `/work`, `/decisions`, `/ai-record` filter
chips. Founder decision, not fixed by a skin.

## Coach routes — page 08, node `1:9`

| Frame | Route | Status |
|---|---|---|
| `39:487` | `/coaching` | BUILT (skin, 10 Sep 2026) |
| `39:980` | `/coaching/$engagementId/$subjectId` | BUILT (skin, 10 Sep 2026) |

Coach skin notes, 10 Sep 2026. Restyled only: `--nb-pencil` hairlines on the
person table, its column rule, the loading rows, the empty-state band, the
confirmed-decision and coaching-note separators and the linked-people cards;
`--radius-control` on the brief, shared-brief and linked-people surfaces;
9px `type/micro` column headers; the person initials disc now carries the
frame's 1.2px `action/secondary-border` edge. Files: `src/pages/CoachingPage.tsx`,
`src/pages/PacketPage.tsx`, `src/components/coaching/CoachLinkPeople.tsx`.
No control, route, query, prop shape or copy changed.

REFUSED under rule 7 (redesign, not a skin): the `/coaching` filter chips
(Everyone / MH-042 / AL-017 / RB-009 / Waiting on you) - a new control with no
covering event under rule 1 - and the per-person status pills, which use the
archived Pill component (rule 11). On `39:980`, the frame's flat
"what to ask about, and why" list plus single-line composer would strand five
existing controls (peek open, analyse, note citations, three-field note save,
coach chat), so rule 8 blocks it.

REFUSED under rule 9 (frame copy the product cannot deliver): hardcoded
"Six people across three engagements", "3 new since Friday" / "1 new this week"
style recency phrasing, the "1:1 THURSDAY" and "NO 1:1 IN 3 WEEKS" pills (no 1:1
scheduling data feeds this page), "9 pieces shared with you · 1:1 on Thursday",
and the invented analysis claims ("1 figure with no source", "the only unsourced
figure across nineteen pieces of work", "reused by three people", "Nine runs
since August"). The Composer `/ SKILLS` chip does not exist in the product.

OPEN: `/coaching` fires no telemetry at all. Opening a person's packet is a user
action with no covering event, and the frame's filter chips would add another.
Same unresolved class as the `/work`, `/decisions`, `/ai-record` and EDU filter
chips. Founder decision, not fixed by a skin. `/coaching/$engagementId/$subjectId`
still fires `packet.viewed`, `note.created`, `coaching.note_created`,
`coachnote.read` and `coach.engagement_shared` unchanged.

Frame `39:980` contains a panel stating the exact number of items a subject withheld.
That contradicts `src/lib/coaching-access.ts` ("Nobody is told when you keep something
back"). It was deliberately NOT built. Do not add it.

## Entry and settings — page 09, node `1:10`

| Frame | Route | Status |
|---|---|---|
| `40:487` | `/` (landing) | **FROZEN — DO NOT TOUCH. See project knowledge rule 15.** |
| `40:760` | `/auth` | BUILT |
| `40:813` | `/join` | NOT STARTED |
| `40:933` | `/join/edu` | NOT STARTED |
| `40:1053` | `/no-access` | BUILT (skin, 10 Sep 2026) — card surface, pencil hairline, 6px radius, 9px mono label, handwritten title. Frame copy and its "Back to your work" / "Ask for access" actions refused (see below); Sign out is the only real control. |
| `43:511` | `/onboarding` | BLOCKED — see below |
| `43:1019` | Settings dialog | BUILT |
| `47:669` | `/trust` | BUILT (skin, 10 Sep 2026) — pencil hairlines, 6px radius, 9px mono micro-labels, handwritten section titles. Frame's stale subprocessor list (Supabase / Anthropic / Resend) refused; production list kept. `PublicHeader` untouched, shared with the frozen `/`. |
| `47:1006` | `/why` | BUILT (skin, 10 Sep 2026) — handwritten section headings, pencil hairlines between sections and above the footer, 6px radius on the CTA card, 9px mono footer labels. Copy unchanged. `PublicHeader` untouched. |
| `47:1125` | `/how-lasso-works` | BUILT (skin, 10 Sep 2026) — pencil hairlines, 9px mono micro-labels, handwritten section titles, 6px radius on the video frames. Both walkthrough events unchanged. Note: route is authenticated, the frame draws a signed-out page. |
| `66:678` | Error state | BUILT (skin, 10 Sep 2026) — `src/lib/error-page.ts` standalone document: card surface with pencil border, 6px radius, 13px body. Palette still mirrored by hand; it cannot import the app stylesheet. |

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

## Artifact viewer — page 10, component level

This page maps to components, not routes, so it gets its own table. Everything here is
a skin: no hook, query, prop, route, control, copy string or event was touched.

| Frame | Component | Status |
| --- | --- | --- |
| V1 · Peek panel | `src/components/peek/PeekPanel.tsx`, `AiReads.tsx` | BUILT (skin, 10 Sep 2026) |
| V2 · What fed this | `src/components/peek/WhatFedThis.tsx` | BUILT (skin, 10 Sep 2026) |
| V3 · Work Artifact | `src/components/journey/WorkArtifactPanel.tsx`, `WorkArtifactSections.tsx` | BUILT (skin, 10 Sep 2026) |
| V4 · Circling a region | none | REFUSED. Self-labelled PROPOSED. Needs a per-claim coordinate, which is a schema change and therefore architect-only. |

Refused inside the built frames, all rule 8 or rule 9:
- The archived Pill component ships twice in this export. Rule 11 forbids it. Production
  `TypeChip` and `Chip` stand.
- "4 sources · 19 turns", "turns 3-19", "2 of 24 pages" — counts the UI does not compute.
- "Slides 12 to 18 have no conversation behind them" — the honest gap line is generated
  per artifact on the server, not a slide range.
- The frame's four flat buttons flatten a bar that really carries Map, two analysis
  presets and an eight-item overflow menu. Flattening it would strand controls.

Telemetry impact: none. `evidence.opened` keeps both emissions and its three surfaces
(`contributor`, `prompt`, `show_all`). `peek.open` stays a gesture-anchored perf finish.
No event name, payload or dimension changed, and no new user action was added.

## Marketing — page 13

This page is not routes. It is marketing collateral plus one shipped email, and it
is the first page that follows the code rather than leading it. There is no route
table because there is nothing to navigate to.

| Frame | What it is | Maps to | Status |
|---|---|---|---|
| M1 · The positioning ladder | Copy doctrine board, four lengths of one idea | No code surface | NON-CODE. Doctrine only; never renders in the app. |
| M2 · The pilot one-pager | US Letter sales PDF | No code surface | NON-CODE. Sales collateral. Rule 9 failures recorded below. |
| M3 · Social cards | Three 1200x630 OG cards | Only consumer is `/` metadata | **FROZEN under rule 15.** Wiring one in changes what `/` serves. Second freeze surface after the hero; the freeze section below now names it. |
| M4 · The invite email, earlier draft | Superseded draft | None | SUPERSEDED. M5's own description says so. Never port it (rule 11 archived-component principle). |
| M5 · Invite email, as shipped | The three real variants | `src/lib/invite-email.ts` | BUILT (skin, 10 Sep 2026) |
| M6 · Email mark notes + GIF source | Production note for `lasso-mark.gif` | Hosted asset, referenced by `LASSO_MARK_URL` | NON-CODE. The mark lives at `charlotte-labs.com/email/lasso-mark.gif`; referenced, not copied. |

M5 skin notes, 10 Sep 2026. Cosmetic only, no string changes: the card border moved
from `MAIL.rule` `#dadad5` to a new `MAIL.pencil` `#b9bbb6` (line/pencil), and the
card width moved from 540 to 544 inside the 600 shell. CTA stays graphite; the
three dark-mode inversion paths are untouched, because M5 explicitly endorses them.
Controls, states and telemetry unchanged: one CTA anchor per variant, one plain-text
URL line, three variants and their degradation states, no telemetry at all (emails
are sent server-side, no `recordEvent` exists in this path).

Rule 9 failures on this page, not built: M2's "above 80%" coverage figure, "3 or
more" reuse count and live pricing placeholder; M3's invented receipt counts ("8
conversations, 61 turns / 11 figures checked at source"); M4's "does not score you
or rank you" (rule 4 forbids the word even in denial) and "You see every note
written about your work" (broader than `coaching-access.ts` supports); M6's note
body carries an em dash that must never travel into shipped copy.

Refused: any M3 wiring, any M4 port, any new marketing route or PDF surface, any
change to the `/` head.

## The landing page is frozen

Route `/` is off limits. Not "do it last" — do not do it at all.

Project knowledge **rule 15** is the binding version and it outranks everything else in
this document. In short: the public marketing landing page, its hero, every section,
component, video, poster image and line of copy it renders, is not to be restyled,
re-ported, rewritten or included in any batch.

The freeze holds even when:
- a Figma page containing frame `40:487` is attached to the message
- a global token, palette, font or motion change would otherwise reach it
- a shared component it uses is being changed for a different screen
- it is the only route left unported
- an instruction says "do every screen" or "finish the redesign"

The `hero.words` motion event is marketing-only and is inside this freeze. Do not
implement it, even during the motion registry pass. OG and social-card imagery
(page 13, frame M3) is also inside this freeze: its only consumer is the public
metadata at `/`, so wiring or regenerating those cards changes what `/` serves.

**If a shared token or component change would alter what renders at `/`, STOP before
doing anything and say exactly what would change there.** That is the case most likely
to break this freeze by accident, because the landing page shares fonts, colours and
primitives with the app.

The founder is handling this page separately and has not settled its direction. Only
the founder lifts this, explicitly, naming the landing page.

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
