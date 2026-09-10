# Members screen port

## Data impact
- Presentation only. No user action, permission, flow, query, event, consent surface, or database behavior changes.
- The existing thirteen controls retain their current gates, so no new telemetry is required.

## Build
1. Update only `src/pages/MembersPage.tsx`, adding the existing `PageHeader`, `SectionHeader`, and `ToneCard` presentation components.
2. Keep the current hook sequence unchanged and add only pure display helpers for initials and role visibility copy.
3. Recompose the loaded view into a main column and 320px right rail. Convert the roster cards into a responsive table-shaped grid without merging pending invites into it.
4. Move the existing invite trigger into the People section header, add the requested metadata header, and preserve the business-dependent plan rendering.
5. Keep all dialogs, menus, notices, and permission gates unchanged. Add no telemetry, query, route, consent, or database work.
6. Verify the source constraints, run TypeScript checks and all member/invite permission tests, inspect the rendered page if authentication is available, then commit without deploying.

## Permission inventory
- Admin only: invite trigger, member action menu, reactivate/deactivate choices, role-change entry, organization data card, and resend.
- Coach row condition only: Share work action.
- Admin or lead: invite menu, copy link, and withdraw.
- Ungated: invite history disclosure.
- Business-sensitive: plan presentation and role-change availability.
- Preserve both non-admin notices and all current dialog titles and accessibility labels.
