# Unit 11 tour update

## Data and scope gate
- Presentation and existing tour interaction changes only.
- No consent surfaces, event names, payloads, dimensions, database work, storage, uploads, or network calls.
- Existing local tour actions remain: Add work, file drop or tap, one work-card click or Space, marquee selection, grouping, Ask, Keep, Back, and Skip.
- Existing render states remain: idle, hint, selected or grouped, asking, completed, and reduced-motion settled.
- No telemetry calls exist in these tour files, and none will be added.

## Changes
- Mark the three Act 2 target work cards with one shared lime dashed interaction treatment and remove the delayed evidence circles as redundant.
- Make click or Space on any target work card select all three and advance once; retain the real marquee path.
- Update Act 2 instruction copy and all tour-visible references from “card” to “work card.”
- Aim the instruction arrow at a measured target work-card edge on desktop and phone.
- Remove the ambient region treatment and label from Acts 2 and 3 while keeping its four chats and Artifact as loose, noninteractive canvas items.
- Reposition all Act 2 and 3 work cards to eliminate pairwise overlaps at 1280px and 390px.
- Replace Act 3’s small cards with the same preview work cards used in Act 2; after grouping, show an existing-token soft purple region and glow around the three selected cards.
- Keep the ambient region in Acts 4 and 5 because it distinguishes supporting board scenery where selection is no longer the lesson.

## Verification
- Update tour tests to drive one-click, Space, and marquee behavior through real controls.
- Run focused tour tests, then the full suite and compare against the accepted 12-file, 30-test outside baseline.
- Check prohibited copy, persistence, network, assets, and lime usage safeguards.
- Use the preview at 1280px and 390px to print arrow-to-card geometry and pairwise overlap results, then capture Act 2 and Act 3 screenshots.
- Report the repository revision containing the changes.
