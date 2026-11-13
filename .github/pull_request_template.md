<!--
Lasso / Charlotte pull request template.
Keep it short. Delete a section only if it truly does not apply, and say why.
No em dashes in copy. Build is not publish: say "preview only" until a deploy is confirmed.
-->

## What changed

<!-- One or two sentences. Name the unit (for example PR2: Tokens). -->

## Named files

<!-- The files this PR was scoped to. Anything outside the list needs a reason. -->

-

## Stop condition

<!-- The condition from the handoff that says this unit is done. Was it met? -->

## Data platform gate (answer all three, every PR)

- **Coverage:** does this add, remove or alter a user action, surface or flow? If yes, name the event that covers it.
- **Consent:** does this touch consent surfaces, event stamping or the consent tables? If yes, the architect handles the database side.
- **Schema:** does this change an event name, payload or dimension? Event schema is additive only.

## Never do (confirm none apply)

- [ ] No rename of `lasso_*` MCP tools, `--lasso-*` tokens, PostHog events, the repo, Supabase or the MCP URL
- [ ] No schema change and no destructive SQL
- [ ] No Lovable prompt on these files while this branch is open (one writer at a time)
- [ ] `bun.lock` unchanged, or the change is explained below

## Review lens

The same six checks run at gates R1, R2 and R3. Tick what was checked, and note what was not.

**Clarity and hierarchy**
- [ ] One focal point per screen. Content first, chrome quiet
- [ ] Type scale held, no off-scale sizes
- [ ] Icons read at 16px without a label, or carry one

**Consistency**
- [ ] One icon language, one stroke, one grid
- [ ] Spacing, radius and colour come from tokens. No literals
- [ ] The same thing looks the same everywhere: board, folder, work kind

**Accessibility**
- [ ] Text 4.5:1. Icons and focus rings 3:1
- [ ] Visible focus on every control. Keyboard order checked
- [ ] Targets 24px minimum, 44px on touch. Reduced motion respected

**States**
- [ ] Empty, loading, error, live and done are all designed
- [ ] The Ask mark is still at idle and moves only while thinking

**Brand discipline**
- [ ] Lime means live, and nothing else
- [ ] The C appears only when Charlotte acts
- [ ] Mascots stay off core work surfaces

**Product truth**
- [ ] It describes work, never workers. No scores about people, no watching language
- [ ] Provenance stays legible: a source line beats a sparkle

## Evidence

- **Tests:** `bunx vitest run` result. Compare failing file names to the baseline, never counts.
- **Screenshots:** desktop (1280) and phone (375), default skin. Add `?brand=charlotte` once the skin exists.
- **Lasso unchanged:** with the skin off, the diff against the baseline set is empty, or each difference is explained.
- **Keyboard and reduced motion:** checked on the surfaces this PR touches.

## Design decision

<!-- If this changes a token or a design decision, link the DESIGN-DECISIONS.md row added in this PR. Without the row the change is incomplete. -->

## Added beyond the brief

<!-- Anything in this PR that was not asked for, and why. "Nothing" is a fine answer. -->

## State

- [ ] Preview only
- [ ] Deploy confirmed (say where and when)
