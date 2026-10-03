# Two isolated user-facing fixes

## Data impact
- Coverage: the expired invite state changes copy only, with no new action. Ask Lasso keeps the existing send action and existing telemetry path, adding a keyboard route to the same action. No new event is needed.
- Consent: no consent surface, consent stamping, or consent table changes.
- Schema and portal: no event name, payload, or dimension changes. No database work.

## Control and state contract
- Before: `/join` has the same loading, missing, not found, revoked, used, expired, creator, signed-out, mismatch, member, and acceptance states. Ask Lasso has its existing textarea, slash and mention pickers, and Send button.
- After: all controls and states remain. Only expired copy reflects the invite's own expiry when available. Desktop Enter invokes the existing send action; Shift+Enter, composing Enter, touch Enter, and empty input do not.
- Telemetry before and after: unchanged. The existing Ask submission path remains authoritative.

## Changes
- Add a small invite-expiry copy helper and focused tests, then use it only in the expired `/join` card.
- Add a small Ask composer keyboard guard and focused tests, then call it from the existing textarea key handler after slash and mention handling.
- Detect touch capability from input capability, not viewport width.

## Verification
- Run focused tests.
- Inspect `/join` and Ask Lasso in the preview at 1280 and 390 where reachable.
- Run the full Vitest suite once, report its literal summary and any failures outside the ten accepted baseline files.
- Check the preview build result. Do not publish.
