# PERF-2 investigation (read only)

## 1. SSR
`src/routes/_authenticated/route.tsx:8` sets `ssr: false`. The server sends only the root shell (`__root.tsx` RootShell, lines ~167/54-63). /home inherits it, so the HTML has no sidebar or Home frame.

## 2. What blocks first paint, in order
1. Client bundle loads and hydrates (all 173 files).
2. `route.tsx:10` `await supabase.auth.getUser()`: a network call to /auth/v1/user.
3. `route.tsx:12` `await fetchProfileState()`. That runs `ensureAuthUser()` (`use-profile.ts:241`). If `sharedQueryClient` is not set yet (it is set at `use-profile.ts:117`), this makes a second getUser call (`:140`), then the profiles query (`:244-250`).
4. Only then does `AppShell` mount (`route.tsx:18`). The ~10 queries start from hooks such as `use-nav-ctx.ts:14-24`.
No timer floor or minimum duration exists on this path. No `pendingComponent`. No Suspense boundary.

## 3. Dead clicks (proven cause)
`beforeLoad` runs again on every navigation inside `_authenticated` (`route.tsx:9-16`). Each run makes two to three network round trips before the child route can match. While it is pending, a click on All work or the Home chip starts a navigation that nothing draws: no pending UI and no new page. The event belongs to the destination, so nothing is written until that page mounts. Warm caches shorten the wait, which matches "works once warm". On /work at 1.0s the link is missing because the shell has not mounted yet (step 4). The overlay and remount candidates are not supported by the code I read.

## 4. Smallest fixes
1. Make `beforeLoad` read cached data: `getSession()` (local, no network) instead of `getUser()`, and pass the result into `ensureQueryData`. Files: `route.tsx`, `use-profile.ts`. Gain: about 1 to 2 round trips per navigation, which ends the dead clicks. Risk: low. A session can be stale, but the existing query retry still checks it.
2. Store the profiles in the query cache with `["profiles"]` so `useProfile` does not ask again. Files: `use-profile.ts`. Gain: one less query. Risk: low.
3. Add a `pendingComponent` that draws the sidebar frame. Files: `route.tsx`, `AppShell.tsx`. Gain: something is visible on screen right away. Risk: low.
4. Plain anchors cannot work before hydration under `ssr:false`, because nothing is drawn before then. Turning SSR on is a larger job and is not proposed here.

## Locations
- (a) `ShareDialog.tsx:53` `onOpenChange={setOpen}`, mounted at `CanvasLabPage.tsx:2781`.
- (b) `SettingsShell.tsx:93` (rail click) and `:69` (opened onto a named section).
- (c) `CanvasLabPage.tsx:224-227` `workboardOpenVia` accepts only header, canvas_tab and default, so "home" falls through to "direct". Passed in at `engagements.$id_.canvas-lab.tsx:64`, emitted at `CanvasLabPage.tsx:509`, link at `HomeEngagementGrid.tsx:164`. The allowed dims are at `workboard-event-allowlist.ts:13`.
- (d) Catalog `telemetry-shared.ts:4` (TelemetryEvent union, for example `:61`, `:315`), dims `event-dim-allowlist.ts` (for example `:137`). Pinned by `e1-environment.test.ts`, `cl1-link-ladder.test.tsx` and `cl2b-attach-chat-link.test.ts`.
