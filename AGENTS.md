Tour workboard chrome stays a local presentational mirror around shared board primitives because the live workboard composition is source-pinned and behavior-coupled.
- Keep container colour inheritance pure in `container-colour.ts`; children never persist inherited colour.
- Filter archived container branches while building the sidebar tree so descendants stay hidden without child writes.
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

- Keep the public demo guide route-local and persist only its numeric step in guarded session storage, because it must never affect signed-in product state.
- Render both public demo entrances through DemoHomeWorkspace so their cards, previews, loading states, and guide behavior stay identical.

- Keep the signed-out `/` story as a public, read-only composition fed only by `openDemoBoardFn`; `/landing-board` redirects to it and preserves hashes.
- Keep the desktop home story zone-selected, transition-queued, and dwell-based after a static use-case section; below 640px use eleven viewport-snapped stops, including use cases as stop 2, fed by the same public payload with no sticky board or scroll-driven transforms.
- Keep the home story tool marks behind ToolLogo, deck art self-contained, and attention motion keyed only to settled story steps.
- Keep the home story connector browser check in normal motion at both desktop sizes, because reduced motion bypasses its live replay timing.
- Render home story captions through the settled-step caption presenter so exit, entry, word reveal, progress, and reduced-motion states stay synchronized with the 800ms dwell.
- Keep landing story navigation in the fixed ten-dot progress rail, with the public header reserved for destination links and account actions, so desktop and phone share one section-jump path.
- Keep `/demo` as a local-state-only playground built from the landing board presentation pieces; preserve the original guided demo at unlinked `/demo/classic`.
- Keep `/demo` deliverable art self-contained and reset its selected slide with the board.
- Keep `/demo` touch gestures pointer-based: one finger on empty board pans, card-origin drags move cards, and two fingers pan and pinch regardless of their starting target.
- Landing: one hero video replays on return; its data wait uses 2.5s logo rain, static under reduced motion.
- Resolve all MCP keys through `mcp_connections`; routes differ only by key transport.
- Keep the first-run interactive tour entirely in local React state; it must never create product rows or upload files.
- Keep every first-run tour act on the single exported board layout and shared board renderer, with answer space reserved before it appears, so items never reflow between acts.
- Classify signed-out entry codes locally: activation-key shapes go through `/j/$code`, while workspace invites retain the existing `/join` flow.
