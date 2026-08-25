# Pass 119 — perf.interaction: how long things actually take

## 0. Repo state

HEAD is `cb06cd4 Fixed skip button in Spine`, working tree clean, no uncommitted or
unexpected edits against the commit you named. Nothing in the tree that I did not
write in earlier passes.

## 1. Reading of the current telemetry code (your four points, checked)

Confirmed, with two corrections.

- `src/lib/telemetry.ts` — `logEvent(eventType, orgId, dims)` is fire and forget,
  merges an onboarding entry dim, calls `recordEventFn`, swallows all errors. Correct.
- `src/lib/telemetry.functions.ts` — `recordEventFn` is auth-gated
  (`requireSupabaseAuth`), `recordAnonymousEventFn` is not. Correct.
- `src/lib/telemetry.server.ts` — one write path: `recordEvent` inserts a row into
  `public.events` (`event_type`, `schema_version 'v1'`, `tenant_hash = sha256(org_id)`,
  `actor_hash = sha256(TELEMETRY_SALT + user_id)`, `dims`, empty `payload`) and then
  awaits `mirrorToPostHog`. Correct.
- PostHog receives events server side, via `POST /i/v0/e/` with
  `$process_person_profile: false` and an org group. No browser SDK exists in this app,
  so no `$`-prefixed autocapture properties are ever present. Correct.

Corrections / things worth knowing:

- **There is no validation of dims anywhere.** `TelemetryDims` is
  `Record<string, string | number | boolean | null | Record<string, number>>` and it
  goes into a `jsonb` column and into PostHog properties untouched. The content rule is
  enforced only by call sites and review. That means the whole content guarantee for
  `perf.interaction` rests on the helper, so the helper must be the only way to emit it.
- **Event names are validated only by TypeScript.** `TelemetryEvent` in
  `src/lib/telemetry-shared.ts` is a string union; adding a member is the entire
  registration step. Nothing at runtime checks it.
- `mirrorToPostHog` is **awaited** inside `recordEvent`, with a 3s timeout. So each
  event costs the server a round trip. It does not block the browser (the client call
  is not awaited), but it does mean high-frequency events are not free server side.
  This shapes the sampling decision below.

### What it takes to add an event type

1. Add `"perf.interaction"` to the `TelemetryEvent` union in `telemetry-shared.ts`.
2. Nothing else.

## 2. Constraint answer (the thing you asked me to stop on)

**No schema change is needed. Nothing for the architect to widen.**

I checked `public.events` read-only:

- constraints: `events_pkey PRIMARY KEY (id)` and nothing else — no CHECK on `event_type`
- `event_type` is plain `text`, not an enum
- `dims` is `jsonb`, unconstrained

So a new event type ships purely in application code. If a CHECK constraint or enum
were ever added later, this is the point that would have to change first.

## 3. The event

`perf.interaction`, dims exactly:

| dim | type | values |
| --- | --- | --- |
| `name` | string | closed vocabulary, below |
| `duration_ms` | integer | exact, rounded, clamped 0..120000 |
| `phase` | string | `paint` \| `write` \| `refetch` \| `total` |
| `surface` | string | `owner` \| `coach` |
| `state` | string | `cold` \| `warm` |

Vocabulary (frozen, typed as a union so an unknown name cannot compile):
`workstream.drag_remap`, `engagement.load`, `canvas.open`, `audit.open`,
`slide.render`, `lasso.resolve`, `ask_dock.open`, `connector.sync`, `peek.open`.

`state`: `cold` = the data behind the interaction was not already in the TanStack Query
cache when the gesture started; `warm` = it was. Derived from
`queryClient.getQueryState(key)?.data !== undefined`, never from anything about the record.

`surface`: from the existing engagement membership / coach role already resolved in the
page, not from a route string.

Nothing else travels. No ids, no titles, no counts, no route paths, no error text.

## 4. The timing helper

New file `src/lib/perf-timing.ts` (client-safe, no server import) plus a thin hook
`src/hooks/use-perf-timer.ts`. No new dependency.

Core idea: measure from the **user gesture** to the **frame in which the UI is usable**,
not to the promise resolving.

```text
pointerup ──► optimistic state set ──► React commit ──► browser paints
   t0                                                      t_paint   = "paint"
       └── server fn resolves ───────────────────────────► t_write   = "write"
             └── invalidated queries settle + repaint ───► t_refetch = "refetch"
   t0 ─────────────────────────────────────────────────► t_total    = "total"
```

"Usable" for a React surface = the first paint after the commit that renders the state
the user is waiting on. Measured as `requestAnimationFrame(() => requestAnimationFrame(cb))`
inside a `useEffect` that runs after that commit: the first rAF is scheduled before the
paint, the second fires after it. That is the honest definition available in the browser
without an SDK; `performance.now()` at both ends, `Math.round` the delta.

API, so call sites stay one line:

```ts
const perf = usePerfTimer({ surface, orgId });

// gesture
const t = perf.start("workstream.drag_remap", { cold: !cached });
// after optimistic render commits
t.paintOnNextFrame();          // emits phase "paint"
await write();  t.mark("write");
await refetch(); t.mark("refetch");
t.done();                       // emits "total"
```

- Timers live in the helper, not in components. Components hold one handle.
- The handle is inert if `orgId` is missing or the timer was already finished, so a
  cancelled gesture emits nothing.
- Emission goes through the existing `logEvent` only. No new transport.

### Overhead, and keeping it near zero

- `performance.now()` and two rAFs per measurement: sub-microsecond, and the rAFs are
  already scheduled frames, so no extra work is created.
- The real cost is the network + the awaited PostHog mirror on the server, once per
  emitted event. Mitigations:
  - **One emit per phase, per interaction.** Drag remap emits at most 4.
  - **Coalescing window**: repeated `paint` emits for the same `name` within 1000ms are
    dropped (a burst of drags reports the first, not thirty).
  - **Sampling**: `slide.render` and `peek.open` are the only high-frequency ones;
    sample them at 1-in-4 via a per-session deterministic gate, so PostHog still gets a
    distribution without a row per page turn. All others 100%.
  - Never measure inside a render body, never inside a pointermove handler.
  - No timers on paths where `orgId` is unknown (marketing, `/join`), which also keeps
    the anonymous path untouched.

## 5. The nine, and where each hook goes

| interaction | anchor | notes |
| --- | --- | --- |
| `workstream.drag_remap` | `EngagementCanvas.endPointer` → `applyMove` → `commit` | t0 at `pointerup`; `paint` at the first frame after `setLocal(next)`; `write` after `remapItems`/`persistOrder` resolve; `refetch` after `onChanged()` and the resulting render commits; `total` in the `finally`. Keyboard moves share `applyMove`, so they are covered for free. |
| `engagement.load` | `useEngagementPage` / `EngagementPage` | t0 at route navigate (router `onBeforeLoad` timestamp stashed in the helper), end at first frame with the page's queries resolved. |
| `canvas.open` | canvas mount inside `EngagementPage` | first frame with columns rendered. |
| `audit.open` | `openProvenanceAudit` in `audit-state.ts` | single choke point: both `WhatFedThisButton` (canvas) and the `what_fed_this` preset in `ChatAnalyses`/`AnalysisLens` go through it, and `use-trace-param` replay is excluded (not a gesture). |
| `slide.render` | `PdfView` effect | t0 when the effect starts, end after page 1's `render(...).promise` and the next frame. Sampled. |
| `lasso.resolve` | ink release in `LassoLayer` → answer card render in the audit | t0 at pointerup on the lasso, `write` at server resolve, `total` at first frame with the answer card. |
| `ask_dock.open` | `ReflectDock`/`AskDock` open transition | end at first frame with the surface rendered; boot fetch reported as `refetch`. |
| `connector.sync` | `ConnectorsPage` sync action | **client-observed only**: gesture to the moment the refreshed list is painted. The server already logs `connector.synced` in `connector-import.server.ts`; this pass does not touch it. |
| `peek.open` | `PeekPanel`/`SlideOver` open | first frame with the panel body rendered, not with its content fully loaded. Sampled. |

## 6. Hardest to measure honestly

1. **`workstream.drag_remap`** — "usable" is ambiguous: the optimistic card lands
   instantly (`setLocal`), but the board is only truthful after `refetch`. That is
   precisely why it is split three ways; the `paint`/`total` gap is the number that
   will explain the complaint.
2. **`engagement.load`** — no single t0 exists client side. Router navigation start is
   the closest honest anchor; a hard page load (SSR + hydration) is a different
   population and I would rather not conflate them. Proposal: only measure in-app
   navigations in this pass, and say so, rather than emitting a number that mixes
   cold document load with client transitions.
3. **`lasso.resolve`** — the animation choreography (settle, "reading the record",
   reveal) is deliberate delay, not slowness. The end mark goes at the answer card's
   first paint *before* the reveal animation, otherwise we would be measuring our own
   art direction.
4. **`slide.render`** — pdf.js worker startup is amortised across the first document
   in a session, so this one skews hard cold vs warm. The `state` dim exists mostly
   for this.
5. **`connector.sync`** — the honest total is server side; the client can only see
   gesture-to-repaint. Labelled as such above.

## 7. Where I think the request is wrong (or worth a second look)

- **`duration_ms` exact, unbucketed.** Every other dim in this codebase is bucketed on
  purpose. A raw millisecond count is not content and does not identify a record, so it
  passes the content rule — but it is a fingerprintable-ish continuous value attached to
  an `actor_hash`. I am happy to ship it exact (you need percentiles, buckets destroy
  them), just flagging the one place this pass departs from house style.
- **No browser SDK is required.** Everything above is `performance.now()` and rAF.
  Nothing in scope needs posthog-js.
- **The awaited PostHog mirror** is the real cost centre of adding a high-frequency
  event, not the client. Hence coalescing and the 1-in-4 sample on the two chatty ones.
  If you would rather have 100% on everything, say so and I will drop sampling.

## 8. Verification

New `src/lib/__tests__/pass119-perf-timing.test.tsx`:
dim shape is exactly the six keys and nothing else; unknown names fail to type; a
cancelled gesture emits nothing; drag remap emits paint/write/refetch/total in order;
coalescing drops a repeat inside the window; `state` flips cold→warm off cache presence;
no id/title reaches dims. Then the full suite, reported.

Commit message: "Pass 119: perf.interaction timing".
