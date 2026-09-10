# Sidebar Figma port

## Scope
- Rewrite the sidebar brand, user card, layout, and footer to match the supplied 264px Worker design.
- Preserve all current destinations, handlers, organization switching, checklist, feedback, sign-out, and walkthrough entry marking.
- Increase navigation icon and label sizing exactly as specified.
- Make only the requested navigation style adjustments in the global stylesheet.

## Data impact
- Visual-only change. No user action, surface, or flow is added or removed, so existing event coverage remains unchanged.
- No consent-related code or event stamping changes.
- No event names, payloads, or dimensions change.

## Verification
- Run the TypeScript typecheck.
- Check current preview build diagnostics after the edits.
- Do not deploy or modify database, route, data, telemetry, dark-mode, or generated files.
