# Unit 2: All conversations shell

## Data impact
- Add one engagement-filter surface and record opens through the existing consent-stamped `logEvent` path as `chatlib.panel_opened`.
- Allow only the closed `panel` values `engagements`, `subjects`, `coverage`, and `recurs` in the UI call sites.
- No consent code, database work, visibility changes, or other event/schema changes.
- This additive event requires a matching portal-side catalogue update.

## Build
- Restructure only `AiRecordPage.tsx` around the existing `nb-chatview` list and reader panes.
- Add the fixed-height list wrapper, 64px header, 46px controls row, internal reader scrolling, and board-area source layouts described in the brief.
- Move existing controls without changing their handlers or server-function payloads; replace inline subjects, coverage, and recurring-analysis areas with the requested popover or slide-over surfaces.
- Remove only the old page header and vendor-logo strip.
- Make month lanes follow the live board height, preserve lane widths and first-four-month fitting, and keep empty-month spines header-only.

## Technical details
- Mirror the Inbox geometry: visible lane top 54px from `(76 + 32) / 2`, with lane height `max(minimum, viewportHeight - 76 - 32)`.
- The minimum is lane header 40px + one 150px conversation card + paging 44px = 234px.
- Add `chatlib.panel_opened` to the event union and non-board dimension allowlist.
- Update only tests that pin removed or relocated shell markup, keeping exact geometry assertions exact.

## Verification
- Run every test importing or text-reading `AiRecordPage`, the event allowlist test, and the new real-fit unit test.
- Run the TypeScript check and confirm the preview build log is clean.
- Add and run `tests/e2e/unit2-conversations-shell.spec.ts` with the existing QA sign-in flow.
- Measure all four requested viewport passes and exercise every requested interaction. Stop after two sizing attempts if the 1440x900 stage scale is not 1.
- Report before/after controls and calls, constants, measurements, interaction results, focused test count, type check, and any out-of-scope work.
