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
- Keep the home story state transition-queued and dwell-based; saved Ask answers replay locally through shared presentation components without sending requests.
- Keep the home story tool marks behind ToolLogo, deck art self-contained, and attention motion keyed only to settled story steps.
- Keep the home story connector browser check in normal motion at both desktop sizes, because reduced motion bypasses its live replay timing.
- Render home story captions through the settled-step caption presenter so exit, entry, word reveal, progress, and reduced-motion states stay synchronized with the 800ms dwell.
- Keep `/demo` as a local-state-only playground built from the landing board presentation pieces; preserve the original guided demo at unlinked `/demo/classic`.
- Keep the `/demo` deliverable as a self-contained local slide viewer whose selected slide resets with the board, because its artwork must never overflow the workboard node.
