Tour mirrors board chrome; preserve live behavior.
- Teammate provenance marks belong only in signed-in CanvasLabPage; never expose them on shared, demo, tour, firm, or rollup surfaces.
- Keep container colour inheritance pure in `container-colour.ts`; children never persist inherited colour.
- Filter archived container branches while building the sidebar tree so descendants stay hidden without child writes.
- MapDialog board-only placement uses ensure_board_default_task and remapItems, sharing first-map recording and entry attribution with optional workstreams.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Public demo guide stays route-local; persist only its numeric step in guarded session storage, never affecting signed-in state.
- Both public demos use DemoHomeWorkspace: identical cards, previews, loading and guide.

- Keep the signed-out `/` story as a public, read-only composition fed only by `openDemoBoardFn`; `/landing-board` redirects to it and preserves hashes.
- Keep the desktop home story zone-selected, transition-queued, and dwell-based after a static use-case section; below 640px use eleven viewport-snapped stops, including use cases as stop 2, fed by the same public payload with no sticky board or scroll-driven transforms.
- Home: ToolLogo marks, self-contained deck art, attention motion only on settled steps.
- Check home connectors in normal motion at both desktop sizes; reduced motion bypasses replay timing.
- Render home story captions through the settled-step caption presenter so exit, entry, word reveal, progress, and reduced-motion states stay synchronized with the 800ms dwell.
- Keep landing story navigation in the fixed ten-dot progress rail, with the public header reserved for destination links and account actions, so desktop and phone share one section-jump path.
- Keep `/demo` as a local-state-only playground built from the landing board presentation pieces; preserve the original guided demo at unlinked `/demo/classic`.
- Keep `/demo` deliverable art self-contained and reset its selected slide with the board.
- Keep `/demo` touch gestures pointer-based: one finger on empty board pans, card-origin drags move cards, and two fingers pan and pinch regardless of their starting target.
- Landing: one hero video replays on return; its data wait uses 2.5s logo rain, static under reduced motion.
- Resolve all MCP keys through `mcp_connections`; routes differ only by key transport.
- First-run tour uses only local React state; never create product rows or upload files.
- Keep the first-run tour's AI conversation examples on one shared elapsed step, while each conversation retains independent local push state.
- Keep every first-run tour act on the single exported board layout and shared board renderer, with answer space reserved before it appears, so items never reflow between acts.
- Source first-run tour Ask scope labels from AskSurface exports so the teaching copy cannot drift from the product chip.
- Classify signed-out entry codes locally: activation-key shapes go through `/j/$code`, while workspace invites retain the existing `/join` flow.
- Emit the tour.* event family only from OnboardingTour, with act number and register as the sole dims, so the preview harness and shared tour primitives never record anything.
- Fit the landing tour through its local measured wrapper, preserving the shared tour's natural dimensions and reserving its scaled height, because preview and onboarding must remain unchanged.

- AffiliationPage exports own affiliation sections and shared-board reads; individual Members and business Affiliation share one disclosure implementation.
- Render phone All work through WorkNote's opt-in list presentation and the existing mobile breakpoint hook, so its dates, source marks, and open handlers share the desktop card truth without changing other surfaces.
- Keep Home's board shell content-height-sized with native scrolling opted in; other board surfaces retain canvas gestures by default so the Home fix cannot alter workboard interactions.
- Keep the signup default notice in data-consent-shared and pin its literal SHA-256 in tests; signup and new-account setup must render that same string without changing existing consent choices or writes.
- Compose role- and product-specific data Settings in DataSection using the existing consent primitives and mutations; normalize legacy section IDs at entry boundaries so old links keep working without a second rail section.
- SharedWithYou owns Home/sidebar reads and actions; never switch profiles on shared entry, so work stays owned locally.
- Read All work shared placements once per page and compare item/board orgs, to avoid per-card requests.
- Node formatting local; other editors visible.
- Render every board control through one measured floating BoardToolbarSurface, keeping menu-less controls and desktop identity pinned and reserving the overflow button for extra menu entries, so identity cannot strand an action; save alerts remain below the bar.
- Board card-face overflow uses BoardCardFaceMenu and the row's shared handler, so both choices clear per-card overrides and emit the same face event.

- All work owns rename; reader closure preserves the dialog.
- Enable chat-link editing only in the All work RowMenu entry point, not shared CardMenu hook consumers; reuse the board dialog and Rename's refresh pattern to preserve ownership and privacy.

- Mirror: real evidence, lane unchanged. Canvas catch: session-add IDs, cleared on finish, never selection. Tick: discussed-work only. Beads retain timing. Nav catch: CSS draw, not canvas. Board hue: id hash, row CSS, not sources.
- Keep mention normalization in the pure shared layer with plain-text offsets, so rich-markup stripping cannot invalidate mention positions.
- Render section-prefixed frames only through LabSection, with drag-start frame/card snapshots and no filing changes, so layout furniture never enters workstream naming or claiming.
- Section backgrounds compose the existing RegionColourSwatches through SectionBackgroundPicker and persist only frame.fill through persistFramePatch; the saved outline uses an SVG dash array so zoom never delegates its rhythm to browser borders.
- Put any new board control in its own component file rather than inline in CanvasLabPage, because nothing renders that page in tests and an inline control cannot be tested.
- Reader vendor marks use BrandLogo and vendorHue in a small presentational child guarded by useVendorVisible, so existing vendor-neutral privacy applies without changing reader content or no-vendor chrome.
- Section Ask resolves membership from live browser board geometry with containingSection at send time and submits an ordinary items scope; persisted section_members remains for server-only consumers to avoid stale-position reads in interactive Ask.
- Keep pilot person joins explicit in authenticated recordEvent mirror context, defaulting other mirror callers to person-less, so anonymous and system paths cannot inherit person-profile processing.
- Emit AI spend through detached recordEvent calls from recordUsage with exact content-free dimensions, so mirrors cannot delay AI responses and other event bucketing stays unchanged.

- Workstream frames always render on the live board; drop prompts have no view-mode parameter, so hiding outlines cannot suppress reassignment.
- Deck strips render as local overlays outside LabCard's measured paper; only the live board opts in, so saved geometry and frozen public surfaces stay unchanged.
