# Notebook port — assessment and remaining pass plan

Assessment of the live codebase as it stands today. Passes 1 and 2 of the original six are already landed (tokens/fonts in pass 83, sidebar retype + icon component in pass 84), so the plan below picks up at pass 3.

## 1. Where the theme lives

- `src/styles.css` (881 lines) is the single source of truth. There is no `tailwind.config.js` and no `postcss.config.js` — this is Tailwind v4, configured CSS-first via `@theme` / `@theme inline`.
- Palette: notebook ramp already defined as `--nb-white / --nb-paper / --nb-grey-1 / --nb-grey-2 / --nb-rule / --nb-ink / --nb-graphite / --nb-mid / --nb-soft / --nb-green / --nb-blue` (lines ~107-183), mapped into shadcn semantic tokens at ~252-272.
- Fonts: `--font-sans: "Archivo"`, `--font-mono: "JetBrains Mono"` (lines 28-29). DM Sans is gone.
- Radii: `--radius` 8px cards, `--radius-control` 6px controls.
- Shadows: `--shadow-card: none` (line 63) — the shadow-to-hairline move is done.
- Motion: `--nb-ease` cubic-bezier(0.2,0,0,1); 120ms grey-step hovers (line 859); icon draw-in 1440ms, signatures 600ms hover / 900ms mount (lines 678-692).
- Hardcoded colours in components: effectively zero. Only 4 non-CSS files contain hex literals — `src/routes/__root.tsx` (theme-color meta), `src/lib/invites.server.ts` and `src/lib/error-page.ts` (email/HTML outside the app CSS), and the `pass83-tokens` guard test itself. Raw Tailwind colour utilities survive in exactly 5 files, one occurrence each: `ui/sheet.tsx`, `ui/drawer.tsx`, `ui/dialog.tsx`, `ui/alert-dialog.tsx` (overlay scrims) and `peek/PdfView.tsx`. No `[#...]` arbitrary colour classes anywhere.
- Worst offenders are therefore the four overlay scrims and the PDF viewer chrome — small, contained work.

## 2. Icon usage

- 46 files import `lucide-react`; roughly 57 distinct glyphs in use.
- Registry-driven usage is concentrated in two files that map data types to icons: `src/lib/work-identity.ts` (BookOpen, Code2, File, FileText, Image, Mail, MessageSquare, Phone, Presentation, Table2) and `src/lib/onboarding-tools.ts` (Bot, CircleDashed, FileText, HardDrive, Mail, MessageSquare, Mic, Sparkles). Swapping these two files converts a large share of visible icons at once.
- shadcn primitives account for another block (Chevron*, Check, Circle, X, PanelLeft, GripVertical, MoreHorizontal, Search, Minus) — these are internal to `src/components/ui/*` and are the lowest-value, highest-churn swap.
- The custom set is at `src/components/notebook/icons.tsx` (24 glyphs, already shipped and used by the sidebar and the Ask Lasso FAB).
- Sizing the swap: app-surface icons the 24-glyph set can cover ≈ 20-25 call sites; the rest (chevrons, check, close, spinner, grip) stay on lucide as deliberate fallbacks. Recommendation: never swap `ui/*` primitives; swap only product surfaces.

## 3. Dark mode

Three `.dark` blocks exist (lines 227, 275, 296) and the variant is `@custom-variant dark (&:is(.dark *))`. They currently still carry pre-notebook hues (e.g. `--state-amber: #e0b06b`).

**Recommendation: keep dark mode alive but freeze it as a maintenance-only surface for now, and give it a derived grey ramp only in the final pass.** Reasoning: the notebook system is defined light-only, and hand-authoring a second palette mid-port doubles the review surface for every pass while the light system is still moving. Freezing avoids that. Deleting dark mode entirely is off the table (it is a functional/UX regression, not aesthetics). At pass 6, derive dark by inverting the ramp (ink surface, paper text) and re-testing only contrast, not layout.

## 4. Risk list for state colours

The Work page semantics ride on a three-tone triad:

- `WorkSection.tsx` exposes `SectionTone = "amber" | "teal" | "indigo" | "neutral"`, consumed by `WorkPage.tsx:558` (amber = unmapped), `:636` (teal = mapped), `:673` (indigo = private).
- Tokens at `styles.css:202-212` have **already been flattened** to notebook neutrals: amber -> `--nb-ink`, teal -> `--nb-green`, indigo -> `--nb-mid`, with all three washes/bands collapsed to `--nb-grey-1`. The inline comment `/* needs mapping */` marks this as unfinished.
- Risk: with all three washes identical, the only remaining distinction is the label colour, and ink vs mid is a weak signal. **Unmapped and Private currently read as nearly the same state.**
- Fix without reintroducing hue: carry the distinction on *form*, not colour — solid ink left rail for Unmapped (action required), green dot/check for Mapped, dashed hairline rail + `--nb-soft` label for Private. Keep the micro-label mono text as the literal fallback.
- Second risk: `src/lib/work-identity.ts` still points type icons at `--hue-amber` / `--hue-indigo` (lines 39-53), which are defined at 260-261 as olive/violet. These leak non-notebook hue into type chips and should collapse to graphite in pass 3.

## 5. Remaining pass plan

### Pass 3 — Work restructure visuals and pile
Files: `src/pages/WorkPage.tsx`, `src/components/work/WorkSection.tsx`, `src/lib/work-identity.ts`, `src/styles.css`.
Do: resolve the state triad per section 4 (rail/dot/dashed form language), collapse `--hue-*` to graphite, add the pile-to-matrix treatment for unmapped work.
Regression risk: users losing the mapped/unmapped read at a glance; counts pills losing contrast.
Verify: all three sections visually distinct in greyscale; count pills legible; mapping actions unchanged.

### Pass 4 — Ask Lasso dock and chat baseline
Files: `src/components/reflect/*` (dock, chat transcript), `src/styles.css`.
Do: right-dock chrome on hairlines, binder-ruled paper background scoped to the transcript only, 28px baseline law, pulsing-dot thinking state replacing any spinner/shimmer.
Regression risk: ruled background bleeding outside the transcript; baseline drift breaking long-message rhythm; streaming indicator swap touching stream logic.
Verify: rules align to 28px at all message lengths, ruling absent everywhere else, streaming still renders token-by-token.

### Pass 5 — Engagement canvas visuals
Files: engagement/workstream/deliverable components and their cards.
Do: surface-step + hairline hierarchy, one green filled primary per screen, blue for links and secondary actions.
Regression risk: multiple green buttons on dense screens; secondary actions reading as disabled.
Verify: per-screen audit of filled-green count; 4.5:1 on every text pair.

### Pass 6 — Graphite marks and dark mode derivation
Files: `src/lib/work-identity.ts`, `src/lib/onboarding-tools.ts`, `src/components/notebook/icons.tsx`, `src/styles.css` `.dark` blocks.
Do: swap the two icon registries to the custom set with documented lucide fallbacks; derive the dark grey ramp.
Regression risk: missing glyphs falling back inconsistently; dark-mode contrast failures.
Verify: every registry entry resolves to a glyph; dark mode contrast checked on sidebar, work sections, chat.

## Constraints held throughout
No SQL, schema, RLS, edge functions, auth, routing structure, or prop-contract changes. Token, class, font, icon, motion and presentational markup only. Suite and typecheck green after each pass; the `pass83-tokens` stale-literal guard updated only if new CSS legitimately trips it.
