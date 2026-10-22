# SHARE-3 assessment: Share dialog by account type

Assessment only. No code changed.

## 1. The email path

Two separate paths exist. Board invites do not use `outbound_emails` today.

- **Queue path (`outbound_emails`).** `runEmailQueue()` in `src/lib/email-queue.server.ts` claims queued/failed rows and calls `sendResendTemplate()` in `src/lib/invites.server.ts`. It is drained by `src/lib/egress.server.ts:237` (the egress sweep cron). `buildVariables()` maps a fixed set of payload keys (WORKSPACE_NAME, JOIN_URL, PRIVACY_LINE, PARTNER_NAME, REASON, ENDS_ON, CONVERSATIONS, SEATS, EXPIRES_DAYS, DAYS, SUPPORT_URL).
- **Direct path (board sharing).** `inviteToBoard` in `src/lib/board-invites.functions.ts` calls the RPC, then sends immediately:
  - if the RPC result carries a `code`: `sendBoardInviteEmail(id)` in `src/lib/board-invite-email.server.ts`, Resend template alias **`board-invite`**, variables INVITER_NAME, BOARD_NAME, ACCESS_LINE, ACCEPT_URL (`/board-invite?code=...`).
  - if status is `pending_approval`: `sendInviteApprovalEmails()`, alias **`invite-approval-needed`**, to workspace admins.
  - Adding a workspace member by name: `setEngagementPersonAccessFn` calls `notifyBoardShared()`, alias **`board-shared`**, plus a `share_received` bell row.

**Where template content lives: in Resend.** `sendResendTemplate` posts `template: { id: alias, variables }`; subject, from and body come from the published Resend template. App code only supplies the alias and variables.

**What adding a `board-invite` template involves:** the app code already exists and already calls it. The missing piece is publishing three templates in the Resend dashboard with those exact aliases and variables: `board-invite`, `board-shared`, `invite-approval-needed`. Nothing in SQL. No app change needed for the send itself. Failures are only `console.error`'d and surface as `emailed: false`, which is why nothing would look broken in `outbound_emails`.

**Unknown to confirm (you, in Resend, not SQL):** whether those three aliases are published. If they are not, every send returns a Resend 4xx and the dialog says the email did not go.

**Unknown to confirm (you, in SQL, read only):** whether `create_board_invite` returns `code` for a recipient who already has a Lasso account. If it returns no code for that branch, that person gets only the in-app notice and no email, which fails the founder's "Send triggers a Resend email" rule.

## 2. Account type in the dialog

`ShareDialog` and `PeopleSection` know nothing about tier or type. They read `listEngagementPeopleFn` (`{ people, canShare, ownerId }`).

- Existing carrier: `useProfile()` / `fetchProfile` in `src/hooks/use-profile.ts` already selects `orgs.tier`, `has_roster` and derives `org_type`. Cheapest, but it describes the **active** workspace, not necessarily the board's.
- Correct and still cheap: add `workspaceTier: "business" | "individual"` to the `listEngagementPeopleFn` payload, read server-side from the board's org (`engagements.org_id` -> `orgs.tier`), falling back through `profileIsBusiness` rules. Additive field, app-only. Recommended.

## 3. Current send paths (confirmed, with one correction)

One combobox input serves both.
- **Pick a colleague:** clicking a suggestion row immediately calls `setEngagementPersonAccessFn` (then `setPersonConversationsFn`). No confirm step. Emits `engagement.access_changed` server-side and sends `board-shared`.
- **Outside email:** typing a valid address not belonging to the workspace shows a row "invite {email}"; clicking it immediately calls `inviteToBoard`. No confirm step. Correction: it is a listbox row under the input, not a dropdown menu. An address belonging to any workspace member is suppressed client-side, so the RPC's "already in this workspace" refusal is normally not reached.
- Level (Viewer/Collaborator via `LEVEL_CHOICES`) and "summaries only" are chosen before clicking and apply to both.

## 4. Multi-email

App-only. In the dialog: split on commas, semicolons, whitespace and newlines; trim, lowercase, dedupe; classify each as invalid, inside-workspace (route to roster add instead, or report), already pending, or valid. On Send, call the existing `inviteToBoard` once per valid address sequentially (keeps RPC and email rate sane), using `Promise.allSettled`-style handling so one failure never undoes another. Show a per-address result list (sent, sent but email failed, waiting for admin approval, refused with reason). Refetch pending invites once at the end. Keep failed addresses in the field so they can be fixed and resent; clear the ones that worked. Cap one Send at 20 addresses. No server change needed; `board.invite_sent` already fires per address.

## 5. Data platform gate

**Coverage.**
| Action | Event |
|---|---|
| Open Share | `board.share_opened` (exists) |
| Send to a picked colleague (new explicit button) | `engagement.access_changed` (exists, server) |
| Send to one or more emails | `board.invite_sent` per address (exists, server) |
| Withdraw pending invite | `board.invite_withdrawn` (exists) |
| Make / expire public link | `board.share_link` (exists) |
| One Send covering several addresses | new: `board.invite_batch_sent`, dims `count_band`, `sent`, `failed`, `skipped` (all small closed integers or bands). Needed so a batch is readable as one action. |

No other new actions. Removing click-to-add is a change of trigger, not a new action; same events fire.

**Consent.** No. Nothing touches consent surfaces, `resolveConsentStamp`, stamping in `telemetry.server.ts`, or `data_consent_state` / `data_consent_ledger` / `set_data_consent`. No email address, name or board title enters any event.

**Schema.** No existing event name, payload or dim changes. One additive event name (`board.invite_batch_sent`) and its allowlist entry in `event-dim-allowlist.ts` and `telemetry-shared.ts`. Nothing repurposed.

## 6. Proposed dialog design

Header: "Share this board". One line under it: "Choose how someone gets to this board. Each option says what it does."

Shared settings block, used by sections A and B:
- Access: segmented Viewer / Collaborator, with the existing line from `ACCESS_LEVEL_DISPLAY`.
  - Viewer: "Can open the board and read every card."
  - Collaborator: "Can open the board, add cards and edit them."
- Checkbox: "Share summaries only, not full conversations." (default off, as today)

**A. People in this workspace** (business and partner only)
- Explainer: "Pick someone already in your workspace. They get an email and the board appears in their sidebar."
- Select listing every active admin and member not already on the board, searchable. Multi-select allowed.
- Button: **Send**. Disabled until someone is picked.

**B. Invite by email** (all workspaces)
- Business/partner explainer: "For people outside your workspace. Enter one address or several, separated by commas. Each person gets an email with a link to accept."
- Individual explainer: "Enter one address or several, separated by commas. Each person gets an email with a link to accept the board."
- Inline helper when an address belongs to a colleague: "{address} is already in your workspace. Add them from the list above."
- Button: **Send**. Results list below it.

**C. Public link** (business and partner)
- Explainer: "Anyone with the link can view this board. No account needed. They cannot edit, and the link expires." Then the existing `shareExposureSentence` and live links list.

**Who has access** list and **Waiting to accept** list stay as today, below the three sections.

## 7. The split

**App only (build tonight):**
- `workspaceTier` in the people payload.
- Dialog restructure into A/B/C with explicit Send buttons, copy in the page `COPY` object.
- Comma-separated parsing, per-address loop, results list.
- `board.invite_batch_sent` event and allowlist entry.
- Tests: tier gating of sections, explicit Send (no add on click), multi-address partial failure, existing assertions on click-to-add will need authorised updates.

**Needs you, not SQL:** publish Resend templates `board-invite`, `board-shared`, `invite-approval-needed` with the variables listed in section 1.

**Needs you, SQL (only if the read shows it):** if `create_board_invite` returns no `code` for an existing-account recipient, it must return one (or the app cannot email them).

## Decisions for you

1. **Individual workspaces and the public link.** Today every workspace can make a link. The brief says individuals get email only. Hiding the link for individuals removes a working control (rule 8). Keep it, or remove it?
2. **Section A multi-select**, or one person per Send?
3. **"Viewer only" for the link** is already true by construction (the shared board page is read only); confirm no change wanted there.
