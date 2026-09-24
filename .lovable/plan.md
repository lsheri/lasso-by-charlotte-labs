# Pass C3: WebGL sun corona

## Data impact
- Visual-only replacement. No person action, flow, database, consent, event name, payload, or dimension changes.
- Existing coverage remains `workboard.context_changed { action }` through the existing `recordEvent` path.
- Keep `context.picked` mapped to `context-corona`; keep its reduced-motion answer unchanged.

## Before-change control and state inventory

**Interactive controls:** none inside the corona layer. Existing card context toggle, marquee selection, board pan/zoom, card drag, and drawing controls remain unchanged.

**Render states:** picked with the C2 CSS flames; picked beyond the 12-card motion cap with a still glow; staggered entry burst; 200ms exit; paused CSS motion during pan, zoom, drag, or marquee; reduced-motion still glow; marquee drag preview.

**Telemetry:** `workboard.context_changed { action: "cleared" | "marquee" | "workstream" | existing single-card action }`. No corona-specific event exists or will be added.

## Implementation
1. Replace the per-card DOM corona shapes with one viewport-bounded, transparent WebGL canvas while preserving its stage position before relationships and cards.
2. Add pure helpers for zoom clamping, measured-height screen/look rectangles, off-screen culling, stable per-card seeds, entry age, and 200ms exit fade.
3. Port the supplied shaders and approved constants exactly. Draw one premultiplied full-canvas quad at up to 30fps, cap moving cards at 12 in reading order, freeze time during interaction, and redraw synchronously for camera/card movement.
4. Keep entry/exit state by card id, retain last geometry while leaving, lazily create WebGL, clear when empty, safely render nothing on unavailable/lost WebGL, and release the context on unmount.
5. Pass pan, zoom, viewport size, interaction state, reduced-motion state, and measured card heights from the existing board page.
6. Remove only the obsolete C2 corona CSS shapes, keyframes, pause rule, and corona reduced-motion rule. Keep the steady C1.1 lime ring/glow and marquee treatments.

## Tests and verification
- Retire C2 assertions for CSS masks, rotating gradient squares, CSS interaction pausing, and the CSS corona reduced-motion block.
- Keep layer order, 12-card cap, stable phase, and board interaction-expression coverage.
- Add pure tests for look clamping, measured-height geometry, look-space conversion, off-screen culling, settled/delayed entry age, exit fade, stable id seed, and the exact approved settings.
- Add a jsdom render test proving missing WebGL mounts safely and draws nothing.
- Run all Canvas Lab tests, named tripwires, the full suite, and confirm the preview build is healthy.

## After-change state inventory
- Picked within the cap: WebGL flames plus the existing steady ring/glow.
- Picked beyond 12: existing steady ring/glow only.
- Entering: reading-order delay, then shader burst and settle.
- Leaving: retained last rectangle with a 200ms fade.
- Pan, zoom, drag, or marquee: frozen shader frame redrawn against current geometry and camera.
- Reduced motion: one still shader frame.
- No WebGL or lost context: existing steady ring/glow only.
- Marquee drag: existing lime box and half-strength card preview unchanged.
