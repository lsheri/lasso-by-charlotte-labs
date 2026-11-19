/**
 * The demo tour's two logins and the reset after a session. Founder only, from the QA seed page: nothing here runs
 * by itself. Every write is scoped to the marked demo workspace, the Marrowfield board and the two tour logins.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { demoEmail } from "./people";
import { actAsDemoPerson, findDemoOrg, findUserId, type ActAs } from "./seed.server";
import { TOUR_BOARD_ID, TOUR_KEEP, TOUR_PEOPLE, tourLeftClean, type TourResetLeft } from "./tour-keep";

type Db = SupabaseClient<Database>;

export type TourLogin = { email: string; name: string; plays: string; password: string };

/**
 * Creates the two tour logins, or gives existing ones a new password. Each password is made here, returned once and
 * never stored by us. Both people join the Marrowfield board as its other members are.
 */
export async function seedTourLogins(admin: Db, newPassword: () => string): Promise<{ logins: TourLogin[] }> {
  const orgId = await findDemoOrg(admin);
  if (!orgId) throw new Error("The demo firm is not seeded.");
  const { data: board, error: boardError } = await admin.from("engagements").select("id, owner_id").eq("id", TOUR_BOARD_ID).eq("org_id", orgId).maybeSingle();
  if (boardError || !board?.owner_id) throw new Error("The Marrowfield board was not found in the demo firm.");

  const logins: TourLogin[] = [];
  for (const person of TOUR_PEOPLE) {
    const email = demoEmail(person.key);
    const password = newPassword();
    let userId = await findUserId(admin, email);
    if (userId) {
      const updated = await admin.auth.admin.updateUserById(userId, { password });
      if (updated.error) throw new Error(`new password for ${email}: ${updated.error.message}`);
    } else {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`creating ${email}: ${created.error?.message ?? "unknown error"}`);
      userId = created.data.user.id;
    }

    const existing = await admin.from("profiles").select("id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
    if (existing.error) throw new Error(`reading the profile for ${email}: ${existing.error.message}`);
    let profileId = existing.data?.id ?? null;
    if (!profileId) {
      const made = await admin
        .from("profiles")
        .insert({ org_id: orgId, user_id: userId, display_name: person.name, role: person.role, onboarding: { welcome_seen: true, checklist: "retired", welcome_board_hidden: true } })
        .select("id")
        .single();
      if (made.error || !made.data) throw new Error(`profile for ${email}: ${made.error?.message ?? "no row"}`);
      profileId = made.data.id;
    }
    const active = await admin.from("user_active_profile").upsert({ user_id: userId, profile_id: profileId });
    if (active.error) throw new Error(`active profile for ${email}: ${active.error.message}`);

    const member = await admin.from("engagement_members").select("profile_id").eq("engagement_id", TOUR_BOARD_ID).eq("profile_id", profileId).maybeSingle();
    if (member.error) throw new Error(`reading board membership for ${email}: ${member.error.message}`);
    if (!member.data) {
      const joined = await admin
        .from("engagement_members")
        .insert({ engagement_id: TOUR_BOARD_ID, profile_id: profileId, member_role: "em", added_by: board.owner_id, conversation_access: "summaries" });
      if (joined.error) throw new Error(`adding ${email} to the board: ${joined.error.message}`);
    }
    logins.push({ email, name: person.name, plays: person.plays, password });
  }
  return { logins };
}

export type TourResetResult = { ok: boolean; refused: boolean; left: TourResetLeft | null; problems: string[] };

async function readLeft(admin: Db): Promise<TourResetLeft> {
  const board = await admin.from("engagements").select("shared_with_firm").eq("id", TOUR_BOARD_ID).maybeSingle();
  const ledger = await admin.from("proposal_ledger").select("id").eq("engagement_id", TOUR_BOARD_ID);
  const value = await admin.from("proposal_ledger_values").select("amount, currency").eq("engagement_id", TOUR_BOARD_ID).maybeSingle();
  const marks = await admin.from("firm_exemplars").select("id").eq("engagement_id", TOUR_BOARD_ID);
  const draft = await admin.from("work_items").select("id").eq("id", TOUR_KEEP.draftItemId).maybeSingle();
  const failed = [board.error, ledger.error, value.error, marks.error, draft.error].find(Boolean);
  if (failed) throw new Error(`reading the board: ${failed.message}`);
  return {
    shared: board.data?.shared_with_firm === true,
    ledgerRows: (ledger.data ?? []).length,
    value: value.data ? `${Number(value.data.amount)} ${value.data.currency}` : null,
    marks: (marks.data ?? []).length,
    draft: Boolean(draft.data),
  };
}

/**
 * Puts the Marrowfield board back after a session and removes what the tour logins made. It first checks that the
 * kept draft and the three kept ledger rows are there, and writes nothing when one is missing. It then reads the
 * board back and reports what it left; `ok` is true only when that is exactly what must be kept.
 */
export async function resetTour(admin: Db, actAs: ActAs = actAsDemoPerson): Promise<TourResetResult> {
  const refuse = (why: string): TourResetResult => ({ ok: false, refused: true, left: null, problems: [why] });
  const orgId = await findDemoOrg(admin);
  if (!orgId) return refuse("The demo firm is not seeded.");
  const { data: board } = await admin.from("engagements").select("id, owner_id, shared_with_firm").eq("id", TOUR_BOARD_ID).eq("org_id", orgId).maybeSingle();
  if (!board?.owner_id) return refuse("The Marrowfield board was not found in the demo firm. Nothing was changed.");

  const keptIds = TOUR_KEEP.ledger.map((row) => row.id);
  const kept = await admin.from("proposal_ledger").select("id").eq("engagement_id", TOUR_BOARD_ID).in("id", keptIds);
  const draft = await admin.from("work_items").select("id").eq("id", TOUR_KEEP.draftItemId).eq("org_id", orgId).maybeSingle();
  if (kept.error || draft.error) return refuse("The kept rows could not be read. Nothing was changed.");
  const missing = keptIds.filter((id) => !(kept.data ?? []).some((row) => row.id === id));
  if (missing.length) return refuse(`A kept ledger row is missing (${missing.join(", ")}). Nothing was changed.`);
  if (!draft.data) return refuse("The kept proposal draft is missing. Nothing was changed.");

  const problems: string[] = [];
  const step = async (what: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
    try {
      const { error } = await run();
      if (error) problems.push(`${what}: ${error.message}`);
    } catch (error) {
      problems.push(`${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // a. Un-share, through the product's own function as the board's owner: the columns change no other way.
  if (board.shared_with_firm) {
    await step("un-sharing the board", async () => {
      const owner = await admin.from("profiles").select("user_id").eq("id", board.owner_id!).maybeSingle();
      const user = owner.data?.user_id ? await admin.auth.admin.getUserById(owner.data.user_id) : null;
      const email = user?.data.user?.email ?? "";
      const asOwner = await actAs(email);
      return asOwner.rpc("set_engagement_firm_share", { p_engagement: TOUR_BOARD_ID, p_on: false });
    });
  }
  // b. Marks made on the board.
  await step("marks", () => admin.from("firm_exemplars").delete().eq("engagement_id", TOUR_BOARD_ID).eq("org_id", orgId));
  // c. Ledger rows a session added, then the three kept rows and the value back to what they were.
  await step("added ledger rows", () => admin.from("proposal_ledger").delete().eq("engagement_id", TOUR_BOARD_ID).not("id", "in", `(${keptIds.join(",")})`));
  for (const row of TOUR_KEEP.ledger) {
    const { id, kind: _kind, ...values } = row;
    await step(`kept ledger row ${id}`, () => admin.from("proposal_ledger").update(values).eq("id", id).eq("engagement_id", TOUR_BOARD_ID));
  }
  await step("value", () => admin.from("proposal_ledger_values").update({ amount: TOUR_KEEP.value.amount, currency: TOUR_KEEP.value.currency }).eq("engagement_id", TOUR_BOARD_ID));
  await step("outcome", () => admin.from("engagements").update({ outcome: null }).eq("id", TOUR_BOARD_ID).eq("org_id", orgId));

  // d. Work the two tour logins made, and its stored files.
  const tourProfiles: string[] = [];
  for (const person of TOUR_PEOPLE) {
    const userId = await findUserId(admin, demoEmail(person.key)).catch(() => null);
    if (!userId) continue;
    const { data } = await admin.from("profiles").select("id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
    if (data?.id) tourProfiles.push(data.id);
  }
  if (tourProfiles.length) {
    const made = await admin.from("work_items").select("id, content_ref").eq("org_id", orgId).in("owner_id", tourProfiles).neq("id", TOUR_KEEP.draftItemId);
    if (made.error) problems.push(`reading the tour logins' work: ${made.error.message}`);
    const ids = (made.data ?? []).map((row) => row.id);
    if (ids.length) {
      await step("the tour logins' work", () => admin.from("work_items").delete().eq("org_id", orgId).in("id", ids));
      const paths = (made.data ?? []).map((row) => row.content_ref).filter((path): path is string => Boolean(path));
      if (paths.length) await step("stored files", () => admin.storage.from("work-files").remove(paths));
    }
  }
  // e. The "sharing changed" notices a session sent.
  await step("notices", () => admin.from("notifications").delete().eq("org_id", orgId).eq("kind", "firm_share_changed").eq("subject_id", TOUR_BOARD_ID));

  try {
    const left = await readLeft(admin);
    return { ok: problems.length === 0 && tourLeftClean(left), refused: false, left, problems };
  } catch (error) {
    return { ok: false, refused: false, left: null, problems: [...problems, error instanceof Error ? error.message : String(error)] };
  }
}
