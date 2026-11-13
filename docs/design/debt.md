# Design debt map

What stands between today's code and a design system a second skin can sit on.
Measured at commit `20a3557` on 13 Nov 2026. Each row says how it was measured, so it can be re-measured.

Tiers: VERIFIED (measured in the repo), DIRECTIONAL (measured, small or partial sample), INFERENCE (reasoned, not measured).

## The three debts that make a reskin risky

| # | Debt | Measure | Tier | Why it matters | Paid down in |
|---|---|---|---|---|---|
| 1 | Tokens are named by hue and used for jobs | `--nb-green` appears 98 times in CSS (93 as `var(--nb-green)`) and 59 times across 34 TS and TSX files. 20 of the CSS lines are focus outlines | VERIFIED: `grep -rho -e '--nb-green'` | One colour does focus rings, selection, "on the record" state, labels and chart ink. Changing the hue changes every job at once | PR0 added the job-named layer (`--state-on-record`, `--wrap-mark`, `--selection`, `--live`, `--icon-ink`, `--icon-ink-active`; `--focus-ring` already existed), read by nothing yet. PR2 moves the focus outlines first |
| 2 | The app skin is a selector, not a token set | 271 rules in `src/styles.css` are scoped to `[data-lasso="on"]`. The file has 149 `!important` declarations | VERIFIED: `grep -c` on `src/styles.css` | A second skin has to out-rank 271 rules. A miss leaves a surface half skinned | PR2 writes overrides one attribute stronger and runs a full screenshot sweep |
| 3 | Two icon languages | `lucide-react` is imported in 93 files. `GraphiteIcon` is used in 33 | VERIFIED: `grep -rl` | Two grids and two strokes. Lucide at 12px with a 1.5 stroke renders under 1px | PR4 gives each skin one glyph map. Lucide keeps stroke 2 below 16px |

## Structure

| Debt | Measure | Tier | Note |
|---|---|---|---|
| One stylesheet carries most of the system | `src/styles.css` is 8,783 lines. `src/design/tokens.css` is 172 | VERIFIED: `wc -l` | Tokens are the small file. The goal is the reverse ratio over time, not a rewrite |
| Colour literals in components | 91 six-digit hex values in TSX files | DIRECTIONAL: includes brand marks and tests that legitimately carry literals | Audit before treating the number as a target |
| The same token means two faces | `--font-mono` is JetBrains Mono at the root and Martian Mono under `[data-lasso="on"]`. `--font-hand` is Caveat at the root and Architects Daughter under the flag | VERIFIED: `src/styles.css` lines 72 to 75 and 7141 to 7143 | Already recorded as a finding on 28 Oct in DESIGN-DECISIONS.md |
| The decision log and the code disagree on type | The 14 Oct row names Young Serif for display. No file in `src` references Young Serif. `--font-display` and `--font-serif` are Instrument Sans | VERIFIED | The 14 Oct row needs a "Superseded" status and a pointer to the row that replaced it |
| `data-brand` is taken | `WorkNote.tsx` uses `data-brand` for vendor tags | VERIFIED | The skin attribute is `data-skin`, never `data-brand` |
| In-app design pages still ship | `/design/icons` and `/motion` are signed-in routes | VERIFIED: `src/routes/_authenticated/` | Storybook replaces them. Retire them in the PR that proves Storybook covers the same ground |
| Reference components live in app source | `src/design/reference/` holds 20 component files | VERIFIED | These become the first stories in PR0 |

## Workbench

Not design debt, but each one blocks working outside Lovable.

| Debt | Measure | Tier | Note |
|---|---|---|---|
| The lockfile points at Lovable's package mirror | 504 entries in `bun.lock` resolve to `*.pkg.dev/lovable-core-prod/sandbox-npm-cache/` | VERIFIED | A plain `bun install` fails where that host is not reachable. Same versions and hashes install from the public npm registry. Do not commit a rewritten lockfile while Lovable still syncs main |
| No `test` script | `package.json` has no `test` entry. `bun test` starts Bun's own runner, not the suite | VERIFIED | The suite is `bunx vitest run`. Add a `test` script in PR0 |
| No CI | There was no `.github/` folder before this branch | VERIFIED | Nothing runs the suite or screenshots on a PR today |
| The server entry is shaped for one host | `src/server.ts` expects `fetch(request, env, ctx)` and `src/lib/background.ts` depends on `ctx.waitUntil` | VERIFIED | On a host that does not pass that context, work scheduled after the response falls back to a detached promise and can be cut off. That work includes event mirroring |
| End to end tests point at the Lovable preview | `playwright.config.ts` defaults `baseURL` to the Lovable preview URL | VERIFIED | Set `LASSO_E2E_BASE_URL` to run against any other target |

## Rules this map does not change

- Never rename `lasso_*` MCP tools, `--lasso-*` tokens, PostHog events, the repo, Supabase or the MCP URL.
- A token change or design decision adds its row to DESIGN-DECISIONS.md in the same change.
- Lasso stays byte-identical with the skin off. Every Charlotte value sits behind `data-skin="charlotte"`.
