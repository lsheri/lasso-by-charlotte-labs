# Focused question walkthrough

## Data impact
- Visual presentation only. No user action, flow, consent surface, event name, payload, or dimension changes.
- Keep the existing `landing.story_section_viewed` event exactly as-is with `{ section, input_mode: "scroll" }`.
- No database work.

## What will change
- Keep the existing four-question scroll sequence and its current active-question calculation.
- Make the question nearest the viewport center the only crisp, fully opaque question and associated visual group.
- Soften the previous and next groups with a stronger blur and fade, rather than removing them from the page. This preserves scroll continuity while directing attention to one group.
- Add substantially more vertical space around every question, especially on phones, so each question, answer, sources, and slide reads as a distinct scene.
- On phones, give each scene enough minimum height and top/bottom breathing room for one scene to dominate the viewport instead of stacking tightly.
- Preserve the desktop sticky deck behavior. Its deck, source cards, and word-stream continue to follow the active question.
- Respect reduced-motion preferences: no animated transition, but retain the clear active/inactive visual hierarchy without disorienting movement.

## Control and state check

### Before
- Walkthrough controls: none. Progress is scroll-driven only.
- Render states: four active-question states; desktop sticky deck and source-word animation; phone inline sources and slide; reduced-motion state; section outside viewport state.
- Event call: `landing.story_section_viewed` with `{ section: beat, input_mode: "scroll" }`, emitted once per viewed question.

### After
- Walkthrough controls: none.
- Render states: the same four active-question states; the same desktop sticky deck and source-word animation; the same phone inline sources and slide; the same reduced-motion and outside-viewport states.
- Event call: unchanged, `landing.story_section_viewed` with `{ section: beat, input_mode: "scroll" }`, emitted once per viewed question.

## Files
- `src/styles.css`: strengthen inactive-question blur/fade, add scene spacing and phone-specific viewport pacing, and preserve the reduced-motion alternative.
- `src/components/marketing/HeroMotion.tsx`: only if needed to expose a semantic state hook for styling; no changes to story content, active-step logic, props, or event behavior.
- `src/lib/__tests__/u4-landing-beats.test.ts`: pin the focused active/inactive treatment, phone spacing, and unchanged event behavior.

## Verification
- Check the landing walkthrough at 393×706 and 1440×900.
- Confirm one question and its associated visuals are crisp at a time, adjacent scenes are visibly softened, and phone scenes no longer feel compressed.
- Confirm scrolling still selects all four questions in order and the desktop deck follows each selection.
- Confirm no horizontal overflow or incoherent overlap.
- Run the focused landing tests and confirm the preview build is clean.
