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
