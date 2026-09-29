# Unit D1: canonical plans funnel

## Build
- Add the canonical URL to `/plans`.
- Add a closed, analytics-only `src` parameter to `/plans` and `/auth`, preserving valid `from` independently.
- Carry both parameters from enabled plan choices into `/auth`.
- Emit `plans.viewed`, `plan.picked`, and `signup.started` through the existing anonymous event path.
- Configure the existing PostHog browser client cookie for `.charlotte-labs.com`.
- Update focused tests for parameter parsing, rendered links, event dimensions, and cookie configuration.

## Data impact
- Adds `plan.picked` and `signup.started`; reshapes `plans.viewed` to use `src`. This requires matching portal-side event vocabulary updates.
- No consent surfaces or consent stamping change.
- `src` remains analytics-only and never reaches workspace attribution or database fields.
- No SQL, schema, migration, RPC, RLS, deployment, or publishing.

## Verification
- Typecheck and focused tests.
- Full test suite twice, accepting only the stated baseline failures and known flakes.
- Browser check `/plans?src=front_door&from=artemis` and report all three rendered signup links.
