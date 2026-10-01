# PF1: inherit attachment placement

## Data platform gate
- Coverage: no new user action or surface. Existing MCP push behavior changes only for attachments sent without a destination after their conversation was placed once.
- Telemetry: keep the existing `mcp.push` event and `attachments_placed` dimension. Add no event, dimension, or renamed value.
- Consent: no consent surface, stamping, or consent-table change.
- Schema and portal: no event-schema change and no portal update.
- Database: no schema, migration, policy, RPC, function, or data work. `mcp_place_item` remains untouched.

## Before contract
- Conversation placement outcomes remain the existing `applyDestination` statuses.
- Attachment storage outcomes remain `new`, `unchanged`, `new_version`, `kept_stored`, `rejected`, `failed`, `reference_created`, or `held`.
- Attachments are placed only when the same call supplies a destination that resolves to a board.
- The response has counts and storage receipts, but no separate placement outcome per attachment.

## Implementation
1. Add a read-only lookup for the conversation's current placement when attachments are present and `destination` is absent.
2. Inherit only an exact single placement, calling the existing `placeOneItem` with `move: false`; never place or move the conversation itself.
3. Leave zero placements in the inbox and classify them `inbox_no_destination`; leave multiple placements in the inbox and classify them `inbox_ambiguous`.
4. Preserve the destination-present path exactly, including its placement arguments and response behavior.
5. Add an additive per-attachment placement receipt `{ title, outcome }`, with outcomes `placed`, `inherited`, `already_there`, `on_other`, `inbox_no_destination`, or `inbox_ambiguous`.
6. Add plain-language notes whenever attachments do not reach the board.

## Verification
- Add handler-driven tests for single, zero, and multiple inherited placements; direct destination byte-for-byte behavior; `on_other`; unchanged conversation placement; and exact `attachments_placed` values.
- Run focused PF1 tests, then the full Vitest suite and `bun run build` after the final edit.
- Report changed files, before/after outcomes, full pass/fail counts and failing files, telemetry invariants, and build exit status. Preview only.
