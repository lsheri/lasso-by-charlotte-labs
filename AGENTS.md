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
- Keep the `/demo` deliverable as a self-contained local slide viewer whose selected slide resets with the board, because its artwork must never overflow the workboard node.
- Render landing hero assembly motion from inert recorded desktop and phone videos with settled posters, because one spatial object cannot overlap at responsive widths.
