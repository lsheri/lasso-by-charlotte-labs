# Reflect screen port

## Scope
- Restyle only `src/pages/ReflectPage.tsx` and add the hook-free `src/components/reflect/WeekRail.tsx`.
- Preserve the existing subtitle, all data wiring, ten-state hook sequence, coach redirect behavior, event calls, dialogs, and child-component mount conditions.
- Add no user action, event, consent change, query, route, or data behavior.

## Implementation
- Convert the content area to the requested responsive three-column layout: sessions, conversation, and weekly work.
- Use the shared `PageHeader` and `ToneCard` patterns, retaining every existing conversation, analysis, source, scope, and session control.
- Wrap each existing answer audit in the requested record-style panel without changing its props or source behavior.
- Feed the new Week rail only from the existing scoped work calculation, showing titles and dates.
- Add the fixed closing panel and handwritten composer note using existing semantic design tokens.

## Technical checks
- Compare the interactive-control inventory before and after.
- Confirm hook order and coach redirect remain unchanged.
- Confirm both `reflect.session_created` calls remain intact.
- Scan the edited files for raw colors and forbidden bare letter-spacing classes.
- Run the TypeScript check and all Reflect-related tests. Do not deploy.
