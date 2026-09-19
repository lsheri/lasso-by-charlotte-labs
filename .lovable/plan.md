# Workboard Frames Part Two

## Data impact
- Adds the local “Move to workstream?” confirmation after a card drag. Yes reuses the existing node update event path; Keep emits nothing.
- Inline workstream creation reuses the existing frame create or materialize path.
- Empty-frame guidance adds copy only. Restored frame selection and menu access reuse existing events.
- No consent, event schema, portal, database, route, production canvas, landing, or AskDock changes.

## Build
- Let pointer input pass through the relationship SVG while retaining a transparent 10px link hit path and a noninteractive connector preview.
- Hide the frame menu entirely when it has no available actions, including for coaches.
- Size newly seeded frames from their seeded card bounds without changing existing durable frame geometry.
- Add a Structured-only drop confirmation positioned under the moved card, with Yes, Keep, Escape, next-drag, and outside-click behavior.
- Add role-appropriate empty-frame guidance for workstreams, Decisions, Outputs, and the zero-task placeholder.
- Add one shared workstream-name submission function used by the existing drawer and the new inline control, with trim, 1–60 character validation, and inline empty-name feedback.

## Technical details
- Keep all existing `CanvasLabPage`, `LabFrame`, and `LabCard` controls, states, persistence paths, and telemetry calls unchanged.
- Add pure geometry helpers for frame-at-point and drop-prompt eligibility, plus seed sizing based on card rectangles.
- Use native buttons and inputs for new compact controls and project tokens for styling.

## Verification
- Add seed containment, geometry/drop-prompt, frame guidance/permissions, shared add-function, relationship hit-path, and menu visibility tests.
- Run focused Canvas Lab tests, TypeScript, token tests, language checks, and inspect the automatic preview build.
