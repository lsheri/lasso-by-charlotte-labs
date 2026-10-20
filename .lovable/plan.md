# Company signup becomes a pilot request (diagnosis + plan)

## 1. Today's signup path (verified)

```text
/plans or landing CTA  ->  /auth?intent=company   (src/routes/auth.tsx, validateSearch L49-73, signup.started L155)
  -> email confirm -> /onboarding?intent=company  (auth.tsx L91-92 / L205 / L264)
  -> src/routes/onboarding.tsx submit handler
       deriveRegister(intent)          src/lib/register.ts
       orgTypeForChoice(...)           src/lib/org-type.ts
       saveUses(...)                   people row
       supabase.rpc("create_org_with_profile", { p_display_name, p_org_name, p_type })   L420
       applyOrgType(profileId, type)   L58  (client-side UPDATE orgs.settings.type, read back)
       logEvent("org.created", orgId, { org_type, tier, register, entry_door })        L448
         entry_door = "intent" whenever a door intent was derived
```

## 2. Where the org is created

A database function: `public.create_org_with_profile`, SECURITY DEFINER. It accepts `company`/`partner` from the client, inserts `orgs` and an admin `profiles` row for `auth.uid()`. No name or domain check, which is why three "Artemis Connection" orgs exist. EXECUTE is granted to `authenticated` and also `anon`.

A second hole: `applyOrgType` writes `orgs.settings.type` from the browser under policy `org_admin_upd`. So any org admin can turn a personal workspace into a company one with a client-side update. Hiding the button alone does not block either path. Enforcement needs SQL (section 5).

## 3. What to reuse

| Piece | Verdict |
|---|---|
| `pilot_requests` table + `submitPilotRequestFn` + Resend template `pilot-request-notify` to liam@ | **Reuse as the request store and the email.** It already holds name, firm, email, team_size and note, and the B2B landing pilot form already writes to it. Needs a few columns added (section 5). |
| `admin_create_workspace` | **Reuse for approval.** Call it with `p_type 'company'`, `p_ends_at now()+3 months`, `p_with_admin_link true`, `p_admin_email = requester`. It creates the org and entitlement, mints an `ADM-` invite and queues `provision-company-admin`. |
| `outbound_emails` / `provision-company-admin` | Reuse unchanged. It is the "you're approved, here is your admin link" email. |
| `pilot_accounts` | Reuse after approval: insert a row (stage `pilot`, started_on, decision_on = +3 months) so the pilot shows in the console pipeline. |
| `key_requests` + `/requests` | **Do not reuse.** It is tied to institutions and partner workshop keys (`admin_approve_request` takes `p_institution_id`). Mixing these would muddy both. |

No new table is needed. `pilot_requests` gets extended.

## 4. Proposed flow

1. A person picks Company on /plans and lands on `/auth?intent=company` as today. Their account is created and confirmed as today, which keeps identity and the funnel intact.
2. `/onboarding?intent=company` shows a **pilot request form** in place of "Create my workspace": your name, firm, team size and an optional note, with the email prefilled from the session. Copy says "Lasso for companies starts with a free 3 month pilot. Liam sets it up by hand, usually within a day." The submit button reads "Request a pilot", with a secondary link "Just me for now" that goes to `intent=personal`.
3. Submit calls an authenticated variant of `submitPilotRequestFn`. It stores the request with `user_id`, `status 'pending'` and `source 'signup'`, then sends `pilot-request-notify` to Liam. The email adds a link to the console review screen and any **existing orgs with a matching name or email domain** (the Artemis case).
4. The person sees "Request received" with a pending state. Returning to /onboarding shows the same pending state. No workspace exists yet, so /work keeps routing them back here.
5. Liam opens the console's Pilot requests list and picks Approve, or Decline with a note. Approve calls a new `admin_approve_pilot_request(id, seats, name?)`. It wraps `admin_create_workspace` (company, 3 month entitlement, admin link bound to the requester's email), inserts `pilot_accounts`, and marks the request approved with its `org_id`.
6. The requester gets `provision-company-admin` with their ADM code and joins through `/join`. `join_org_with_invite` makes them admin. Colleagues then come in through normal invites.
7. If an org already exists for the firm, Liam can decline and send an invite to that existing org instead, so no duplicate is created.

**Invited company people:** `/join` uses `join_org_with_invite`, a separate function, and `/onboarding` already redirects pending invites to /join (beforeLoad L219-221). Invites never touch `create_org_with_profile`, so they keep working. The SQL change must touch only `create_org_with_profile`, never the invite function. An ADM approval link takes the same invite path.

**Telemetry (additive):** `pilot.requested` {source, team_size}, `pilot.approved` {seats}, `pilot.declined`. `org.created` is no longer emitted for company from onboarding. Approval-created orgs come from the console, so check whether the console already emits for `admin_create_workspace`.

## 5. Split: UI-only vs SQL you run

### SQL / RLS (yours)
1. `create_org_with_profile`: refuse `company` and `partner` unless the caller is a platform admin. Choose between raising a clear error or downgrading to personal (raising is recommended so it is visible). REVOKE EXECUTE from `anon`.
2. `orgs.settings.type` lock: a BEFORE UPDATE trigger that rejects a change of `settings->>'type'` to `company`/`partner` unless the caller is a platform admin. This closes the `applyOrgType` client write and the Settings WorkspaceKindCard path.
3. `pilot_requests`: add `user_id uuid`, `status text default 'pending'` (pending/approved/declined), `source text`, `decided_at`, `decided_by`, `decision_note`, `org_id uuid`. Add an RLS select policy so a requester can read their own row by `user_id = auth.uid()` (for the pending state). Writes stay through the server function's admin client.
4. New `admin_approve_pilot_request` and `admin_decline_pilot_request` (SECURITY DEFINER, `is_platform_admin(...,'ops')`), plus `admin_pilot_requests()` for listing, including likely duplicate orgs.
5. Optional: a uniqueness guard against creating a company org whose name matches an existing org, case-insensitive.
6. The three existing Artemis orgs: a data clean-up decision for you, outside this unit.

### UI / server code (build)
- `src/routes/onboarding.tsx`: company and partner registers render the request form and pending state instead of the create call. Personal and edu are unchanged.
- `src/lib/pilot-request.functions.ts`: an authenticated `submitSignupPilotRequestFn` (requireSupabaseAuth). It reuses the schema, insert and notify.
- `src/lib/pilot-request.server.ts`: add a console link and a duplicate hint to the template variables. The Resend template needs those variables too, so that is a template edit in Resend.
- Console: a Pilot requests list with Approve/Decline beside the existing admin screens.
- Copy in one exported COPY object, plus tests: the company register never calls `create_org_with_profile`, personal still does, and the invite path is untouched.
- `/plans` Business CTA label becomes "Request a free pilot". This is a label change only.

Open decisions: seats default for an approved pilot, whether `partner` signup is also gated (assumed yes), and decline wording.
