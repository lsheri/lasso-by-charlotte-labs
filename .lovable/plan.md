# Typography scale change: bigger, bolder h2 and p elements

## Goal
Make every `<h2>` and `<p>` element in the app larger and semibold, using a fixed scale rather than relative doubling.

## Scope
All routes and components (whole app), per the user's selection.

## Plan
1. Audit the current `src/styles.css` base and the existing `.nb-binder-body` rules that force h2/p to 14px.
2. Add global CSS rules in `src/styles.css` after the `@theme inline` block:
   - `h2` → `font-size: 1.5rem` (text-2xl), `font-weight: 600` (semibold), `line-height: 1.2`.
   - `p` → `font-size: 1.25rem` (text-xl), `font-weight: 600` (semibold), `line-height: 1.4`.
3. To ensure the new scale applies app-wide, use `!important` on `font-size` and `font-weight` for these base selectors. This intentionally overrides any existing Tailwind `text-sm` / `text-base` / `font-normal` classes on `<h2>` and `<p>` elements.
4. Inspect the notebook/binder transcript view and the current engagement page. The 14px baseline grid will be disrupted; adjust the notebook body rules so headings and paragraphs still sit cleanly on the grid (e.g., set `.nb-binder-body h2` to inherit the new h2 size and `.nb-binder-body p` to inherit the new p size, with matching line-height).
5. Open the preview, navigate to `/engagements/10905547-6078-402f-8849-7c9edf592e8e` and a few other pages, and verify nothing is clipped or overflowing. Tighten spacing where needed in a follow-up pass.

## Risk to call out
The notebook design system deliberately keeps all h2/p at 14px to sit on a baseline grid. Applying this change will break that grid until the notebook body rules are updated in step 4. The marketing pages and auth forms will also be affected, which is intended, but dense screens may need extra spacing tweaks.
