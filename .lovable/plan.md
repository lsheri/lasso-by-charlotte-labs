# Unit 3.3: Demo tour placement

## Data impact

Placement only. No user action, event name, event payload, consent surface, schema, or database behavior changes.

## Control and state parity

Before and after, `/demo` keeps its engagement links and pilot link; `/demo/$code` keeps its back link, board controls, pilot link, preset chips, answer close, source disclosure, exact-turn links, and reader close. Loading, unavailable, board, answer-open, answer-closed, reader-open, and highlighted-turn states remain. Existing telemetry calls and payloads remain byte-for-byte unchanged.

## Changes

1. On screens below 640px, dock the note to a fixed bottom strip with 12px gutters and safe-area spacing. Point its drawn mark upward toward the active anchor.
2. When each phone step appears, scroll its anchor above the strip. Expose the strip height as a page-level CSS variable so the demo content and preset chip bar remain above it.
3. On desktop, sample candidate note rectangles on a 40px grid and explicitly count intersections with the preset chip bar and any visible fixed or sticky bar.
4. Extend the placement tests for the phone dock, dense collision sampling, explicit bar collisions, scrolling, and temporary bottom clearance.
5. Walk steps 1 through 7 at 1372×732 and 390×844, recording placement and collision count for each step.

## Files

- `src/components/demo/DemoTourNote.tsx`
- `src/styles.css`
- `src/pages/DemoPages.tsx` only if a stable demo-page clearance hook is required
- `src/lib/__tests__/unit3-demo-tour.test.tsx`
