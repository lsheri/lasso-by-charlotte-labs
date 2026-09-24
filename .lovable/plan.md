# Dimensional Lasso motion

## Data impact
- Visual-only change. It adds no user action, surface, flow, stored data, or event.
- No event name, payload, or dimension changes.
- No consent-related code or database work.

## Direction
Create one distinctive lime particle motion that reads clearly at every existing size:

1. **Clock face**: particles begin on a face-on loop with clear near and far depth.
2. **Horizon turn**: the loop rotates edge-on until it becomes a narrow horizon, using particle size, spacing, and opacity to show depth.
3. **Loose orbit**: particles move through asymmetric, deterministic paths so the sequence feels organic rather than repetitive.
4. **Lasso resolve**: the particles pull into the open Lasso loop and tail used beside the Lasso name, then hold long enough to read before the next cycle.

The cycle will be roughly five seconds, with a calm pause on the completed Lasso shape. Randomness will be seeded, so motion feels varied without jumping when React renders again.

## Build
- Replace only the internal geometry and timing used by `LassoThinkingMark` and its existing maths helper.
- Keep the existing component name, props, kinds, sizes, and every current call site intact.
- Apply the dimensional signature at its current placements: beside “Welcome to Lasso,” in the board’s Ask Lasso button, and in the Ask Lasso panel header.
- Let the thinking variants share the same dimensional turn and Lasso resolve while preserving the verified item-count behavior of the larger reading mark.
- Keep lime as the sole mark colour, drawn from the existing Ask Lasso token. Add no glow colour or new visual token.
- Scale depth and particle radius for the existing 20px, 28px, 36px, 56px, and 72px marks so the silhouette remains apparent in compact buttons.
- Respect reduced motion by drawing a still, completed open Lasso loop rather than freezing an intermediate frame.
- Pause rendering while a mark is outside the viewport, as it does now.

## Preservation check
### Before
- `LassoThinkingMark` has no controls and emits no events.
- Render modes: orbit, loop, gather with verified count, trace, signature, reduced-motion still, offscreen pause, and unmount cleanup.
- Surrounding controls remain: the board Ask Lasso toggle, Ask panel tabs and composer, Home’s New engagement and Past work actions, and the Home idea form.
- Existing event calls remain unchanged, including `home.opened`, `home.new_engagement_started`, `home.past_work_opened`, `home.ideas_note_composed`, and `reflect.trail_opened`.

### After
- The same controls, render modes, handlers, event calls, labels, sizes, and layouts remain.
- Only the lime mark’s particle geometry, depth, timing, and completed silhouette change.

## Verification
- Extend the maths checks for deterministic variation, face-on and horizon phases, completed open-loop geometry, cycle continuity, and reduced-motion end state.
- Keep the existing toolbar, Home, Ask Lasso, thinking-trail, and mascot assertions passing.
- Run the focused motion, Home, board-toolbar, Ask Lasso, and trail checks, then type safety.
- Verify live at Home, the board Ask Lasso button, and an active Ask Lasso thinking state at desktop and compact sizes. Confirm the mark stays inside its button, the Lasso resolve is readable, reduced motion is still, and no surrounding layout shifts.
