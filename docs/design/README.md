# How design works here

The repo is the design system. A design is real once it is in tokens, glyphs and stories that ship. Everything else, such as Figma, Claude artifacts and Magic OS, is a sketchpad for it or a view of it.

## Where each layer lives

| Layer | Lives in | Role |
|---|---|---|
| Decisions | `DESIGN-DECISIONS.md` | The why. One row per decision, in the same change as the value |
| Guidelines | `docs/design/` (this folder), shown inside Storybook | Foundations and patterns |
| Tokens | `src/design/tokens.css` | Every colour, type, radius, shadow and motion value |
| Glyphs | `src/components/notebook/icons.tsx` | The GraphiteIcon set: one 20px grid, one stroke |
| Reference components | `src/design/reference/` | The decided component code the app copies |
| Stories | `storybook/stories/` | Every glyph, token and reference component, plus the screens canvas |
| Baseline pictures | `tests/e2e/__baseline__/` | The "before" set every design change is compared against |
| Debt | `docs/design/debt.md` | What stands between today's code and a second skin |

## The lifecycle

1. **Explore** in Figma, an artifact or Magic OS. Nothing is decided there.
2. **Decide** with a row in `DESIGN-DECISIONS.md`.
3. **Specify** as tokens, glyphs and a story.
4. **Build** in a pull request, behind the skin when it changes how anything looks.
5. **Verify** with the baseline pictures, the screens canvas and an accessibility check.
6. **Release** when Liam confirms a deploy.

## Skins

The default skin is Lasso. A second skin overrides the job-named tokens in `tokens.css` and nothing else, under `data-skin`. Tokens are named by job (`--state-on-record`, `--live`), not by hue, so a skin changes a job without touching every place the hue appears. `data-brand` is taken by vendor tags, so the skin attribute is `data-skin`.

## Running Storybook

Storybook runs on this Mac only for now. It is its own package, so the app's install and lockfile stay untouched.

```
cd storybook
bun install
bun run dev       # opens on http://localhost:6106 (6006 belongs to another project)
bun run build     # static build in storybook/storybook-static
```

Use the Skin menu in the Storybook toolbar to switch skins. Storybook loads the skins through `src/styles.css`, the same way the app does.

## Rules that apply to every design change

- The Lasso default stays byte-identical unless a decision row says otherwise.
- Never rename `--lasso-*` tokens.
- No em dashes in copy, docs or commit messages.
- Lasso describes work, never workers.
