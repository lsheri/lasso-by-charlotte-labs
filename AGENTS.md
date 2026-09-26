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

- Keep `/landing-board` as an unlinked, public, read-only composition fed only by `openDemoBoardFn`; its proof excerpts are derived server-side from demo-org turns through the public allowlist.
- Keep `/landing-board` story state transition-queued and dwell-based; saved Ask answers replay locally through shared presentation components without sending requests.
- Keep `/landing-board` tool marks behind ToolLogo, deck art self-contained, and attention motion keyed only to settled story steps.
