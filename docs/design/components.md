# Building a component

The checklist for any new or changed component in the app. It keeps a reskin cheap: a skin changes about 18 values in one place, and nothing in a component should need touching when it does. The why behind each rule is in `DESIGN-DECISIONS.md`; the counts that police them are in `src/design/design-health.json`.

## Before you write it

1. **Look for the piece first.** `src/components/ui/` holds the primitives: Button, Input, Textarea, NativeSelect, Select, Dialog, AlertDialog, DropdownMenu, Switch, Tooltip and the rest. Pills are `chipVariants` (a control) and `tagVariants` (a label), from `chip.ts` and `tag.ts`. If one fits, compose it; do not restyle it.
2. **Need a new primitive?** Add it to `src/components/ui/`, styled only with tokens, with one comment saying when to use it and what not to use instead. Then use it. A one-off style written inside a feature file becomes the next audit's debt.
3. **Write a decision row** when the component changes how anything looks.

## While you write it

| Use | Not |
|---|---|
| Type roles: `text-(length:--type-label)`, `--type-small`, `--type-body` and the rest of the scale | `text-[11px]`, `font-size: 13px` |
| Corner roles: `rounded-[var(--radius-control)]` and the other `--corner-*` roles | `rounded-[6px]`, `border-radius: 6px` |
| Job colours: `text-muted-foreground`, `border-border`, `bg-accent-soft`, `text-destructive`, `border-primary` | Hex values, `var(--nb-*)` names, hue names for a job |
| Named layers (`--layer-*`) for anything that floats above the page | `z-[60]`, `z-index: 60` |
| `chipVariants` / `tagVariants` combined with `cn()` | `rounded-full … font-mono … uppercase` written out |
| `NativeSelect` for short fixed choices, `Select` for rich option rows | A raw `<select>` |
| `GraphiteIcon` | A new Lucide import |
| Plain CSS specificity | `!important` |

- **Own file.** A board control or dialog goes in its own component file, never inline in `CanvasLabPage`, because nothing renders that page in tests (AGENTS.md).
- **Props in, effects out.** Keep data loading and server calls at the edge (a hook, or the dialog's own server functions) and pass plain values in, so the component can be rendered in a test and a story.
- **Lock until loaded.** A form that loads saved values keeps its fields disabled until they arrive, so a late load never overwrites what a person chose.
- **Honest failure.** A refused or failed write keeps the dialog open with a plain line in `role="alert"`; it never closes as if it worked.
- **Copy** lives in a `*_COPY` object beside the logic, in plain words, no em dashes, describing work, never workers.
- **Telemetry** names go in `telemetry-shared.ts` and their dims in `event-dim-allowlist.ts`, content free.

## Before you merge

1. **Tests:** a component test in `__tests__/` covering the happy path, a refused write and any validation; pure rules in a `*-shared.ts` file with their own unit tests.
2. **Design health:** `src/design/__tests__/design-health.test.ts` passes. If a count fell, lower its ceiling in `design-health.json` in the same change. Never raise one without a decision row.
3. **The PR checks:** the full vitest suite within baseline, `NITRO_PRESET=node-server bun run build`, and the brand guard.
4. **Look at it:** screenshots from a real worktree (a linked `node_modules` cannot load the web fonts), Charlotte, desktop and phone. For a CSS-only move, the compiled CSS should be byte-identical.
5. **Log it:** a row in `docs/design/health-log.md` for design PRs.

## What the guard counts

| Count | Rule |
|---|---|
| `rawFontSize` | `text-[Npx]` and `font-size: Npx` not read from a token |
| `rawRadius` | Literal lengths in `rounded-[…]` and `border-radius` |
| `hexInComponents` | Colour literals in TS and TSX |
| `legacyNbReads` | `var(--nb-*)` uses outside the token files |
| `literalZIndex` | `z-index: N` and `z-[N]` |
| `importantRules` | `!important` in CSS |
| `nativeSelect` | A raw `<select>` outside `src/components/ui` |
| `handPills` | A class string outside `src/components/ui` with `rounded-full`, `font-mono` and `uppercase` |
| `lucideFiles` | Files importing `lucide-react` |

Every number may only go down.
