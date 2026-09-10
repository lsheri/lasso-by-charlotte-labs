# Join and no-access notebook restyle

## Data impact
- Presentation only. No user action, flow, query, authentication behavior, event name, payload, consent surface, or database behavior changes.
- The existing event path and all four named join telemetry/toast calls remain unchanged.

## Verified state and control inventory
- `/join` has all 11 listed render states: missing code, loading, not found, revoked, used, expired, invite creator, signed out, already a member, account mismatch, and acceptance form.
- `/join` has the listed controls: Copy link; three Go to workspace buttons; two Sign out and continue buttons; Go to sign in; Set up your account; name label/input; Join submit with its existing disabled and pending states; and the displayed error result. The error card is feedback rather than an interactive control.
- `/no-access` has one control: Sign out, retaining its existing three-step handler.
- No listed control is stranded by the proposed layout.

## Implementation
- Restyle only JSX and class names in `src/routes/join.tsx` and `src/routes/no-access.tsx`.
- Use the existing `BrandLockup` and notebook tokens for centered entry cards. Keep every route option and all code above rendering behavior unchanged.
- Keep all ten non-form join states separate through `StateCard`, updating only shared card chrome, mono labels, and serif titles.
- Restyle `AcceptForm` with the real inviter, organization, and engagement values; generated initials; a serif title; hairline; and two compact, marked explanation sections.
- Wire the single primary “Accept and set up” button to the existing form submission without changing any submission logic.
- Retain current fallback wording when inviter details are absent. Do not add the unsupported “Not now” action.
- Restyle `/no-access` with the same visual language while retaining its true workspace-access wording and existing Sign out action. Add only the privacy-safe honest-silence sentence and handwritten line.

## Copy verification
- Verify subject visibility of coach notes before using “every”; soften the statement if any note can remain unavailable.
- Verify coach exclusion of drafts and unmapped work before keeping that promise.
- Search for a real user export/download/takeout capability. If none exists, omit the handwritten export promise entirely.

## Validation
- Compare the before/after state and control inventories.
- Confirm route configuration, hook order, queries, backend calls, navigation targets, and the four named telemetry/toast sites are unchanged.
- Check both files for raw color literals and forbidden bare letter-spacing utilities.
- Run TypeScript validation and relevant entry/invite/access tests, then inspect the latest build signal.
- Do not deploy or perform database work.

## Sidebar token correction
- Keep the sidebar structure, navigation logic, hooks, gates, links, dialogs, switchers, counts, and controls unchanged.
- Change `.nb-group-header` to Caveat Bold at 16px/20px in primary ink, without capitals or letter spacing.
- Change `.nb-nav-item-active` to the raised white surface with a 1.2px graphite border, 6px radius, Archivo Medium, and primary ink.
- Change `.nb-nav-shelf` from the retired blue treatment to the existing muted graphite treatment without changing shelf behavior.
- Add a sidebar-only inline open-loop SVG variant to `LassoLogo`; preserve its current image rendering for `SessionHeader`, `Wordmark`, and `PublicHeader`.
- Skip the handwritten status line unless an existing sidebar-safe source already provides the exact new/unprocessed conversation count without another query.
- Report old and new values, all other `LassoLogo` consumers, status-source findings, logic preservation, and TypeScript validation.
