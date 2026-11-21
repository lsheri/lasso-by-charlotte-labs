import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";

import { DEMO_BOARDS } from "./index";
import { DEMO_PEOPLE, demoEmail } from "./people";
import { DEMO_CONTACTS, DEMO_LEAD_LOGINS, DEMO_LOST_PROPOSALS, DEMO_OPEN_PROPOSALS, DEMO_WON_PROPOSALS } from "./proposals";
import { CARD_H, CARD_W, fileNameFor, nextSlot, outcomeLine, planBoard, sectionTop, seedMeta, slideMap, sourceFor } from "./plan";
import type { DemoBoard, DemoFirm, DemoItem } from "./types";

type Db = SupabaseClient<Database>;

/** The marker on the demo org, so a second run refuses and a reset can only ever touch this one workspace. */
export { DEMO_FIRM_MARKER } from "../demo-firm-marker";
import { DEMO_FIRM_MARKER } from "../demo-firm-marker";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function must<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) throw new Error(`${what}: ${result.error?.message ?? "no row returned"}`);
  return result.data as NonNullable<T>;
}

export async function findDemoOrg(admin: Db): Promise<string | null> {
  const { data } = await admin.from("orgs").select("id").eq("settings->>demo_firm", DEMO_FIRM_MARKER).maybeSingle();
  return data?.id ?? null;
}

/** Finds an auth user by email, page by page; the admin API has no lookup by email. */
async function findUserId(admin: Db, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listing users: ${error.message}`);
    const hit = data.users.find((user) => user.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(admin: Db, email: string, password: string): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  const existing = await findUserId(admin, email);
  if (!existing) throw new Error(`creating ${email}: ${created.error?.message ?? "unknown error"}`);
  await admin.auth.admin.updateUserById(existing, { password });
  return existing;
}

/** Step 1: the workspace and its people. Refuses if the demo firm already exists (reset first). */
export async function seedDemoPeople(admin: Db, firm: DemoFirm, password: string): Promise<{ orgId: string; people: number }> {
  if (await findDemoOrg(admin)) throw new Error("The demo firm already exists. Reset it first.");
  const org = must(
    await admin.from("orgs").insert({ name: firm.name, settings: { type: "company", demo_firm: DEMO_FIRM_MARKER } }).select("id").single(),
    "creating the workspace",
  );
  for (const person of firm.people) {
    const uid = await ensureUser(admin, demoEmail(person.key), password);
    const profile = must(
      await admin
        .from("profiles")
        .insert({
          org_id: org.id,
          user_id: uid,
          display_name: person.name,
          role: person.role,
          onboarding: { welcome_seen: true, checklist: "retired", welcome_board_hidden: true },
        })
        .select("id")
        .single(),
      `profile for ${person.name}`,
    );
    await admin.from("user_active_profile").upsert({ user_id: uid, profile_id: profile.id });
  }
  // The demo's Lead logins share the same password; their People rows are linked at the finish, once they exist.
  const leads = await seedDemoLeadLogins(admin, org.id, password);
  return { orgId: org.id, people: firm.people.length + leads.made.length };
}

/** What the Lead logins step did. `password` is set only when it made a login with a password of its own. */
export type LeadLoginsResult = { made: string[]; password: string | null; linked: number; linkWaits: boolean };

/**
 * 21 Nov 2026, chat pill PR 4a (D-97): Christy Johnson and Adaeze Nwosu as Lead logins in the demo only, linked to
 * their People rows. Safe to run again: an existing login keeps its password, an existing profile is left alone, and
 * a row already linked is not touched. A login made here on an existing demo gets a new password, returned once.
 * Before the link column exists (PR 4a's SQL), the logins are made and the link waits: `linkWaits`.
 */
export async function seedDemoLeadLogins(admin: Db, orgId: string, password: string | null): Promise<LeadLoginsResult> {
  const loose = admin as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const result: LeadLoginsResult = { made: [], password: null, linked: 0, linkWaits: false };
  for (const lead of DEMO_LEAD_LOGINS) {
    const contact = DEMO_CONTACTS.find((entry) => entry.key === lead.contact);
    if (!contact) continue;
    const email = demoEmail(lead.contact);
    let uid = await findUserId(admin, email);
    if (!uid) {
      const secret = password ?? (result.password ??= (await import("../qa-seed.functions")).newQaPassword());
      const created = await admin.auth.admin.createUser({ email, password: secret, email_confirm: true });
      if (!created.data.user) throw new Error(`creating ${email}: ${created.error?.message ?? "unknown error"}`);
      uid = created.data.user.id;
      result.made.push(email);
    }
    const { data: existing } = await admin.from("profiles").select("id").eq("org_id", orgId).eq("user_id", uid).maybeSingle();
    let profileId = existing?.id ?? null;
    if (!profileId) {
      profileId = must(
        await admin
          .from("profiles")
          .insert({
            org_id: orgId,
            user_id: uid,
            display_name: contact.name,
            role: lead.role,
            onboarding: { welcome_seen: true, checklist: "retired", welcome_board_hidden: true },
          })
          .select("id")
          .single(),
        `profile for ${contact.name}`,
      ).id;
      await admin.from("user_active_profile").upsert({ user_id: uid, profile_id: profileId });
    }
    // The demo's own People row of that name, only while it is linked to nobody.
    const link = await loose
      .from("roster_contacts")
      .update({ profile_id: profileId })
      .eq("org_id", orgId)
      .eq("full_name", contact.name)
      .is("profile_id", null)
      .select("id");
    if (link.error) {
      if (link.error.code === "42703" || link.error.code === "PGRST204") result.linkWaits = true;
      else throw new Error(`linking ${contact.name}: ${link.error.message}`);
    } else result.linked += (link.data ?? []).length;
  }
  return result;
}

/** The demo org's people, by roster key (from the email). */
async function demoPeople(admin: Db, orgId: string): Promise<{ profileId: Map<string, string>; userId: Map<string, string> }> {
  const { data, error } = await admin.from("profiles").select("id, user_id").eq("org_id", orgId);
  if (error) throw new Error(`reading people: ${error.message}`);
  const profileId = new Map<string, string>();
  const userId = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.user_id) continue;
    const { data: user } = await admin.auth.admin.getUserById(row.user_id);
    const email = user.user?.email?.toLowerCase() ?? "";
    if (!email.endsWith("@kestrelbay.test")) continue;
    const key = email.split("@")[0]!;
    profileId.set(key, row.id);
    userId.set(key, row.user_id);
  }
  return { profileId, userId };
}

/** Signs in as someone through a one-time link that is never emailed (generateLink only returns it). */
export type ActAs = (email: string) => Promise<Db>;

export const actAsDemoPerson: ActAs = async (email) => {
  if (!email.endsWith("@kestrelbay.test")) throw new Error("Only demo logins can be acted as");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) throw new Error(`signing in as ${email}: ${link.error?.message ?? "no link"}`);
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set");
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (session.error) throw new Error(`signing in as ${email}: ${session.error.message}`);
  return client;
};

/** The demo firm's admin partner: clients can only be added by an admin or lead, checked against the signed-in user. */
const DEMO_ADMIN = DEMO_PEOPLE.find((person) => person.role === "admin")!.key;

/** Step 2, once per board. Skips a board that is already there, so a failed run can simply be repeated. */
export async function seedDemoBoard(
  admin: Db,
  board: DemoBoard,
  actAs: ActAs = actAsDemoPerson,
): Promise<{ items: number; showings: number; skipped: boolean }> {
  const orgId = await findDemoOrg(admin);
  if (!orgId) throw new Error("Create the demo firm's people first.");
  const { data: existing } = await admin.from("engagements").select("id").eq("org_id", orgId).eq("title", board.title).maybeSingle();
  if (existing) {
    // The workboard is written after every item, so a board without one stopped part way: clear it and start again.
    const { data: done } = await admin.from("workboards").select("id").eq("engagement_id", existing.id).maybeSingle();
    if (done) {
      await repairBoard(admin, orgId, board, done.id);
      return { items: 0, showings: 0, skipped: true };
    }
    await clearPartialBoard(admin, orgId, board, existing.id);
  }
  const { profileId, userId } = await demoPeople(admin, orgId);
  for (const key of board.team) if (!profileId.has(key)) throw new Error(`${board.key}: ${key} has no demo login`);
  const partner = await actAs(demoEmail(DEMO_ADMIN));
  return { ...(await seedBoard(admin, partner, orgId, board, profileId, userId)), skipped: false };
}

/** Removes what a stopped run left of one board: its items (tagged with the board key), files, tasks, members, the board and its client. */
async function clearPartialBoard(admin: Db, orgId: string, board: DemoBoard, engagementId: string): Promise<void> {
  const { data: items } = await admin.from("work_items").select("id, content_ref").eq("org_id", orgId).eq("source_meta->>demo_board", board.key);
  const paths = (items ?? []).map((row) => row.content_ref).filter((path): path is string => Boolean(path));
  if (paths.length) await admin.storage.from("work-files").remove(paths);
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`clearing ${board.key} (${what}): ${error.message}`);
  };
  if (items?.length) fail("work", (await admin.from("work_items").delete().in("id", items.map((row) => row.id))).error);
  fail("client marks", (await admin.from("client_showings").delete().eq("engagement_id", engagementId)).error);
  // The owner cannot leave a live board, so it is archived before its members go.
  fail("archive", (await admin.from("engagements").update({ archived_at: new Date().toISOString() }).eq("id", engagementId)).error);
  fail("members", (await admin.from("engagement_members").delete().eq("engagement_id", engagementId)).error);
  fail("tasks", (await admin.from("tasks").delete().eq("engagement_id", engagementId)).error);
  fail("board", (await admin.from("engagements").delete().eq("id", engagementId)).error);
  fail("client", (await admin.from("clients").delete().eq("org_id", orgId).eq("name", board.client.name)).error);
}

/** Step 3: placing cards notified everyone on each board; the demo starts with a quiet inbox. */
export async function finishDemoSeed(admin: Db, actAs: ActAs = actAsDemoPerson, now: Date = new Date()): Promise<ProposalSeedResult | null> {
  const orgId = await findDemoOrg(admin);
  if (!orgId) return null;
  // The proposals and people the backfill used to paste (20 Nov): written here, so a reseed brings them back.
  const proposals = await seedDemoProposals(admin, actAs, now);
  // The Lead logins (PR 4a), made here too for a demo seeded before them, and linked to their People rows.
  const leadLogins = await seedDemoLeadLogins(admin, orgId, null);
  // Each demo person has said they use the app for work, so Home skips the first-use question.
  const { userId } = await demoPeople(admin, orgId);
  const rows = [...userId.values()].map((user_id) => ({ user_id, uses: ["work"], uses_declared_at: new Date().toISOString() }));
  if (rows.length) {
    const uses = await admin.from("people").upsert(rows, { onConflict: "user_id" });
    if (uses.error) throw new Error(`recording uses: ${uses.error.message}`);
  }
  const { error } = await admin.from("notifications").delete().eq("org_id", orgId);
  if (error) throw new Error(`clearing notifications: ${error.message}`);
  return { ...proposals, leadLogins };
}

async function seedBoard(
  admin: Db,
  partner: Db,
  orgId: string,
  board: DemoBoard,
  profileId: Map<string, string>,
  userId: Map<string, string>,
): Promise<{ items: number; showings: number }> {
  const owner = profileId.get(board.team[0]!)!;
  const client = must(
    // Written as the admin partner: the database lets only an admin or lead add a client, checked on the signed-in user.
    await partner.from("clients").insert({ org_id: orgId, name: board.client.name, quick_folder: false }).select("id").single(),
    `client ${board.client.name}`,
  );
  const engagement = must(
    await admin
      .from("engagements")
      .insert({
        org_id: orgId,
        client_id: client.id,
        title: board.title,
        code: "",
        brief: board.brief,
        brief_by: owner,
        owner_id: owner,
        outcome: outcomeLine(board),
        shared_with_firm: board.sharedWithFirm,
        created_at: `${board.start}T09:00:00Z`,
      })
      .select("id")
      .single(),
    `board ${board.key}`,
  );
  const members = board.team.map((key) => ({ engagement_id: engagement.id, profile_id: profileId.get(key)!, member_role: "em" as const, added_by: owner }));
  must(await admin.from("engagement_members").insert(members).select("profile_id"), `members of ${board.key}`);

  // Tasks: the loose-work default plus one per workstream.
  const defaultTask = must(
    await admin
      .from("tasks")
      .insert({ engagement_id: engagement.id, owner_id: owner, name: "Not in a workstream", is_board_default: true, position: 2147483647 })
      .select("id")
      .single(),
    `default task for ${board.key}`,
  );
  const taskId = new Map<string, string>();
  for (const [position, name] of (board.workstreams ?? []).entries()) {
    const task = must(
      await admin.from("tasks").insert({ engagement_id: engagement.id, owner_id: owner, name, position }).select("id").single(),
      `workstream ${name}`,
    );
    taskId.set(name, task.id);
  }

  // Work items, their text, turns and index cards.
  const itemId = new Map<string, string>();
  const itemHash = new Map<string, string>();
  const itemRef = new Map<string, string | null>();
  for (const item of board.items) {
    const id = await seedItem(admin, orgId, board.key, item, seedMeta(board, item), profileId.get(item.author)!, userId.get(item.author)!);
    itemId.set(item.key, id.id);
    itemHash.set(item.key, id.hash);
    itemRef.set(item.key, id.contentRef);
    if (item.placed !== false) {
      const task = taskId.get(item.section) ?? defaultTask.id;
      must(await admin.from("work_item_tasks").insert({ task_id: task, work_item_id: id.id }).select("work_item_id"), `placing ${item.key}`);
    }
  }

  // The canvas: frames, cards, stickies and links.
  const plan = planBoard(board, () => crypto.randomUUID(), (name) => taskId.get(name)!);
  const workboard = must(
    await admin.from("workboards").insert({ engagement_id: engagement.id, org_id: orgId, created_by: owner }).select("id").single(),
    `workboard for ${board.key}`,
  );
  if (plan.frames.length) {
    must(
      await admin
        .from("workboard_frames")
        .insert(
          plan.frames.map((frame) => ({
            id: frame.id,
            workboard_id: workboard.id,
            key: frame.key,
            kind: frame.kind,
            label: frame.label,
            task_id: frame.taskName ? taskId.get(frame.taskName)! : null,
            sequence_no: frame.sequenceNo,
            ord: frame.ord,
            x: frame.x,
            y: frame.y,
            w: frame.w,
            h: frame.h,
            created_by: owner,
            updated_by: owner,
          })),
        )
        .select("id"),
      `frames for ${board.key}`,
    );
  }
  const authorOf = new Map(board.items.map((item) => [item.key, profileId.get(item.author)!]));
  const nodeRows = [
    ...plan.cards.map((card) => ({
      id: card.nodeId,
      workboard_id: workboard.id,
      kind: "work_item",
      work_item_id: itemId.get(card.itemKey)!,
      client_key: `work:${itemId.get(card.itemKey)!}`,
      frame_id: card.frameId,
      x: card.x,
      y: card.y,
      w: CARD_W,
      h: CARD_H,
      title: board.items.find((item) => item.key === card.itemKey)!.title,
      body: "",
      author_profile_id: authorOf.get(card.itemKey)!,
      created_by: authorOf.get(card.itemKey)!,
      updated_by: authorOf.get(card.itemKey)!,
    })),
    ...plan.stickies.map((sticky) => ({
      id: sticky.nodeId,
      workboard_id: workboard.id,
      kind: "sticky",
      work_item_id: null,
      client_key: `sticky:${sticky.nodeId}`,
      frame_id: null,
      x: sticky.x,
      y: sticky.y,
      w: 200,
      h: 140,
      title: "",
      body: JSON.stringify({ text: sticky.text, size: "body", weight: "regular", colour: "ink", fill: sticky.fill }),
      author_profile_id: owner,
      created_by: owner,
      updated_by: owner,
    })),
  ];
  if (nodeRows.length) must(await admin.from("workboard_nodes").insert(nodeRows).select("id"), `cards for ${board.key}`);
  await writeSlideMaps(admin, board, itemId, itemHash, itemRef);
  const nodeOf = new Map(plan.cards.map((card) => [card.itemKey, card.nodeId]));
  if (plan.links.length) {
    must(
      await admin
        .from("workboard_links")
        .insert(
          plan.links.map((link) => ({
            workboard_id: workboard.id,
            from_node_id: nodeOf.get(link.fromItem)!,
            to_node_id: nodeOf.get(link.toItem)!,
            from_anchor: "right",
            to_anchor: "left",
            relation: link.relation,
            author_profile_id: owner,
            created_by: owner,
            updated_by: owner,
          })),
        )
        .select("id"),
      `links for ${board.key}`,
    );
  }

  // Shown to client: written directly (no signed-in actor), with the version the client saw.
  const showingRows = board.items.flatMap((item) =>
    (item.shown ?? []).map((showing) => ({
      org_id: orgId,
      engagement_id: engagement.id,
      work_item_id: itemId.get(item.key)!,
      shown_on: showing.on,
      occasion: showing.occasion,
      content_hash: itemHash.get(item.key)!,
      marked_by: profileId.get(item.author)!,
    })),
  );
  if (showingRows.length) must(await admin.from("client_showings").insert(showingRows).select("id"), `client marks for ${board.key}`);
  return { items: board.items.length, showings: showingRows.length };
}

async function seedItem(
  admin: Db,
  orgId: string,
  boardKey: string,
  item: DemoItem,
  extraMeta: Record<string, Json>,
  owner: string,
  authUser: string,
): Promise<{ id: string; hash: string; contentRef: string | null }> {
  const { source, sourceVendor, fidelity } = sourceFor(item.vendor, item.type);
  const text = item.type === "ai_thread" ? (item.turns ?? []).map((turn) => `${turn.role}: ${turn.content}`).join("\n\n") : (item.body ?? "");
  const hash = await sha256Hex(text);
  let contentRef: string | null = null;
  const fileName = fileNameFor(item);
  if (item.type !== "ai_thread") {
    contentRef = `${authUser}/${crypto.randomUUID()}-${fileName}`;
    const upload = await admin.storage
      .from("work-files")
      .upload(contentRef, new Blob([text], { type: "text/markdown" }), { contentType: "text/markdown", upsert: false });
    if (upload.error) throw new Error(`storing ${item.key}: ${upload.error.message}`);
  }
  const row = must(
    await admin
      .from("work_items")
      .insert({
        org_id: orgId,
        owner_id: owner,
        title: item.title,
        type: item.type,
        source,
        source_vendor: sourceVendor,
        source_meta:
          item.type === "ai_thread"
            ? { demo_firm: true, demo_board: boardKey }
            : { filename: fileName, mime_type: "text/markdown", demo_firm: true, demo_board: boardKey },
        meta: item.type === "ai_thread" ? { ...extraMeta } : { mime_type: "text/markdown", ...extraMeta },
        content_ref: contentRef,
        content_hash: hash,
        content_fidelity: fidelity,
        visibility: item.visibility === "private" ? "private" : "unmapped",
        ts_precision: "source",
        created_at_source: `${item.date}T15:00:00Z`,
        work_date: item.date,
        captured_at: `${item.date}T15:05:00Z`,
      })
      .select("id")
      .single(),
    `item ${item.key}`,
  );
  if (item.type === "ai_thread") {
    const turns = await Promise.all(
      (item.turns ?? []).map(async (turn, index) => ({
        work_item_id: row.id,
        turn_no: index + 1,
        role: turn.role,
        content: turn.content,
        content_hash: await sha256Hex(turn.content),
        ts: `${item.date}T15:${String(index).padStart(2, "0")}:00Z`,
        ts_precision: "source" as const,
        meta: {},
      })),
    );
    must(await admin.from("turns").insert(turns).select("id"), `turns for ${item.key}`);
  }
  must(
    await admin
      .from("work_item_extracts")
      .insert({
        work_item_id: row.id,
        owner_id: owner,
        org_id: orgId,
        summary: item.summary,
        decisions: item.decisions ?? null,
        entities: item.entities ?? null,
        handoff: null,
        source_chars: text.length,
        model: "demo-seed",
        content_hash: hash,
        schema_version: 1,
      })
      .select("id"),
    `index card for ${item.key}`,
  );
  await moveSeedFees(admin, orgId, row.id, item.type === "ai_thread" ? { ...extraMeta } : { mime_type: "text/markdown", ...extraMeta });
  return { id: row.id, hash, contentRef };
}

/**
 * F2: a seeded SOW's fee goes to the server-only fee table, not the meta every member's browser reads. Before the
 * table exists, storeSowTerms leaves the meta as it was.
 */
async function moveSeedFees(admin: Db, orgId: string, itemId: string, meta: Record<string, Json>): Promise<void> {
  const facts = meta["sow_facts"];
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return;
  const { storeSowTerms } = await import("../fee-terms.server");
  const next = await storeSowTerms(admin as never, { itemId, orgId, meta, facts: facts as Record<string, unknown> });
  if (JSON.stringify(next) === JSON.stringify(meta)) return;
  const update = await admin.from("work_items").update({ meta: next as never }).eq("id", itemId);
  if (update.error) throw new Error(`moving fees for ${itemId}: ${update.error.message}`);
}

/** Deck cards preview their first slide from document_versions.slide_map; one version per seeded deck. */
async function writeSlideMaps(
  admin: Db,
  board: DemoBoard,
  itemId: Map<string, string>,
  itemHash: Map<string, string>,
  itemRef: Map<string, string | null>,
): Promise<void> {
  const rows = board.items
    .filter((item) => item.type === "deck" && itemRef.get(item.key))
    .map((item) => ({
      work_item_id: itemId.get(item.key)!,
      version_no: 1,
      content_ref: itemRef.get(item.key)!,
      content_hash: itemHash.get(item.key)!,
      slide_map: slideMap(item.body ?? ""),
      source_event: "initial_capture",
      origin: "upload",
    }));
  if (rows.length) must(await admin.from("document_versions").insert(rows).select("id"), `slides for ${board.key}`);
}

/**
 * Brings a board seeded by an earlier version up to date, safely repeatable: adds what the board's data gained since
 * (see topUpBoard), moves sections below the empty Workstreams box on boards without workstreams, and adds the slide
 * maps deck cards preview from.
 */
async function repairBoard(admin: Db, orgId: string, board: DemoBoard, workboardId: string): Promise<void> {
  await topUpBoard(admin, orgId, board, workboardId);
  const top = sectionTop(board);
  if (top > 0) {
    const { data: frames } = await admin.from("workboard_frames").select("id, y").eq("workboard_id", workboardId);
    const lowest = Math.min(...(frames ?? []).map((frame) => frame.y));
    const shift = Number.isFinite(lowest) && lowest < top ? top - lowest : 0;
    if (shift > 0) {
      for (const frame of frames ?? []) await admin.from("workboard_frames").update({ y: frame.y + shift }).eq("id", frame.id);
      const { data: nodes } = await admin.from("workboard_nodes").select("id, y").eq("workboard_id", workboardId);
      for (const node of nodes ?? []) await admin.from("workboard_nodes").update({ y: node.y + shift }).eq("id", node.id);
    }
  }
  const decks = board.items.filter((item) => item.type === "deck");
  if (!decks.length) return;
  const { data: rows } = await admin
    .from("work_items")
    .select("id, title, content_ref, content_hash")
    .eq("org_id", orgId)
    .eq("source_meta->>demo_board", board.key)
    .eq("type", "deck");
  const ids = (rows ?? []).map((row) => row.id);
  if (!ids.length) return;
  const { data: existing } = await admin.from("document_versions").select("work_item_id").in("work_item_id", ids);
  const has = new Set((existing ?? []).map((row) => row.work_item_id));
  const itemId = new Map<string, string>();
  const itemHash = new Map<string, string>();
  const itemRef = new Map<string, string | null>();
  for (const deck of decks) {
    const row = (rows ?? []).find((entry) => entry.title === deck.title);
    if (!row || has.has(row.id)) continue;
    itemId.set(deck.key, row.id);
    itemHash.set(deck.key, row.content_hash ?? "");
    itemRef.set(deck.key, row.content_ref);
  }
  await writeSlideMaps(admin, { ...board, items: decks.filter((deck) => itemId.has(deck.key)) }, itemId, itemHash, itemRef);
}

export type ProposalSeedResult = { people: number; won: number; lost: number; open: number; ledger: number; leadLogins?: LeadLoginsResult };

/**
 * The demo firm's proposals and the people it works with (20 Nov 2026, chat pill build Phase 2), from proposals.ts.
 * The same rows backfill-kestrel.sql pasted, so a reseed brings them back. Safe to run again: a person is matched by
 * name, a won proposal by its board, any other by title and client, and a ledger row by board and kind, so nothing
 * is added twice and nothing already there (the live backfill, Larkspur, Pellham, Harrowgate) is changed. Writes no
 * phone number, email, text agreement, ask or fee. Every row is in the marked demo workspace.
 */
export async function seedDemoProposals(admin: Db, actAs: ActAs = actAsDemoPerson, now: Date = new Date()): Promise<ProposalSeedResult> {
  const orgId = await findDemoOrg(admin);
  if (!orgId) throw new Error("Create the demo firm's people first.");
  const loose = admin as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const read = async <T>(table: string, columns: string): Promise<T[]> => {
    const { data, error } = await loose.from(table).select(columns).eq("org_id", orgId);
    if (error) throw new Error(`reading ${table}: ${error.message}`);
    return (data ?? []) as T[];
  };
  const insert = async (table: string, rows: Record<string, unknown>[], what: string) => {
    if (rows.length === 0) return;
    const { error } = await loose.from(table).insert(rows);
    if (error) throw new Error(`${what}: ${error.message}`);
  };
  const { profileId } = await demoPeople(admin, orgId);
  const result: ProposalSeedResult = { people: 0, won: 0, lost: 0, open: 0, ledger: 0 };

  // People we work with: name, role and firm only.
  const known = await read<{ id: string; full_name: string }>("roster_contacts", "id, full_name");
  const missingPeople = DEMO_CONTACTS.filter((contact) => !known.some((row) => row.full_name === contact.name));
  await insert(
    "roster_contacts",
    missingPeople.map((contact) => ({
      org_id: orgId,
      full_name: contact.name,
      role_title: contact.role,
      affiliation: contact.firm ? "firm" : "independent",
      firm_name: contact.firm,
    })),
    "people we work with",
  );
  result.people = missingPeople.length;
  const people = await read<{ id: string; full_name: string }>("roster_contacts", "id, full_name");
  const leadId = (key: string | null) => {
    if (!key) return null;
    const name = DEMO_CONTACTS.find((contact) => contact.key === key)?.name;
    return people.find((row) => row.full_name === name)?.id ?? null;
  };

  const [boards, existing, ledger] = await Promise.all([
    read<{ id: string; title: string; client_id: string | null; owner_id: string | null; archived_at: string | null }>("engagements", "id, title, client_id, owner_id, archived_at"),
    read<{ engagement_id: string | null; title: string; client_id: string }>("proposals", "engagement_id, title, client_id"),
    read<{ engagement_id: string; kind: string }>("proposal_ledger", "engagement_id, kind"),
  ]);
  let clients = await read<{ id: string; name: string }>("clients", "id, name");
  const clientId = (name: string) => clients.find((row) => row.name === name)?.id ?? null;
  const taken = (title: string, client: string) => existing.some((row) => row.title === title && row.client_id === client);

  // Won: one per older board, as Record the win leaves it, with the firm's figures for it.
  const won: Record<string, unknown>[] = [];
  const figures: Record<string, unknown>[] = [];
  for (const entry of DEMO_WON_PROPOSALS) {
    const board = DEMO_BOARDS_BY_KEY().get(entry.board);
    const engagement = board ? boards.find((row) => row.title === board.title && !row.archived_at) : undefined;
    const owner = board ? profileId.get(board.team[0]!) : undefined;
    if (!board || !engagement?.client_id || !owner || existing.some((row) => row.engagement_id === engagement.id)) continue;
    const decidedAt = new Date(Date.parse(`${board.start}T09:00:00Z`) - 17).toISOString();
    won.push({
      org_id: orgId,
      client_id: engagement.client_id,
      title: board.title.slice(0, 160),
      notes: board.brief.slice(0, 8000) || null,
      owner_id: owner,
      received_at: entry.receivedAt,
      sent_at: entry.sentAt,
      status: "won",
      decided_at: decidedAt,
      engagement_id: engagement.id,
      lead_contact_id: leadId(entry.lead),
      created_at: entry.receivedAt,
    });
    const has = (kind: string) => ledger.some((row) => row.engagement_id === engagement.id && row.kind === kind);
    // A board with an outcome of its own already keeps it; no second one is written.
    if (has("won") || has("lost")) continue;
    const steps: [string, string | null][] = [["brief_received", entry.receivedAt], ["sent_to_client", entry.sentAt], ["won", decidedAt]];
    for (const [kind, at] of steps)
      if (at && !has(kind)) figures.push({ org_id: orgId, engagement_id: engagement.id, kind, occurred_at: at, created_at: decidedAt });
  }
  await insert("proposals", won, "won proposals");
  await insert("proposal_ledger", figures, "the firm's figures");
  result.won = won.length;
  result.ledger = figures.length;

  // Lost: for clients the firm has, no board.
  const lost: Record<string, unknown>[] = [];
  for (const entry of DEMO_LOST_PROPOSALS) {
    const board = DEMO_BOARDS_BY_KEY().get(entry.clientOf);
    const client = board ? clientId(board.client.name) : null;
    const owner = profileId.get(entry.owner);
    if (!client || !owner || taken(entry.title, client)) continue;
    lost.push({
      org_id: orgId,
      client_id: client,
      title: entry.title,
      notes: entry.notes,
      owner_id: owner,
      received_at: entry.receivedAt,
      sent_at: entry.sentAt,
      status: "lost",
      decided_at: entry.decidedAt,
      engagement_id: null,
      lead_contact_id: leadId(entry.lead),
      created_at: entry.receivedAt,
    });
  }
  await insert("proposals", lost, "lost proposals");
  result.lost = lost.length;

  // Open: the buyer script's starting point, dated from now. Their clients are new, added as the admin partner
  // (the database lets only an admin or lead add a client).
  const newClients = [...new Set(DEMO_OPEN_PROPOSALS.map((entry) => entry.client))].filter((name) => !clientId(name));
  if (newClients.length) {
    const partner = await actAs(demoEmail(DEMO_ADMIN));
    for (const name of newClients) must(await partner.from("clients").insert({ org_id: orgId, name, quick_folder: false }).select("id").single(), `client ${name}`);
    clients = await read<{ id: string; name: string }>("clients", "id, name");
  }
  const open: Record<string, unknown>[] = [];
  for (const entry of DEMO_OPEN_PROPOSALS) {
    const client = clientId(entry.client);
    const owner = profileId.get(entry.owner);
    if (!client || !owner || taken(entry.title, client)) continue;
    const received = new Date(now.getTime() - entry.receivedHoursAgo * 3_600_000).toISOString();
    open.push({
      org_id: orgId,
      client_id: client,
      title: entry.title,
      notes: entry.notes,
      owner_id: owner,
      received_at: received,
      sent_at: entry.sentAfterHours === null ? null : new Date(Date.parse(received) + entry.sentAfterHours * 3_600_000).toISOString(),
      status: "open",
      decided_at: null,
      engagement_id: null,
      lead_contact_id: leadId(entry.lead),
      created_at: received,
    });
  }
  await insert("proposals", open, "open proposals");
  result.open = open.length;
  return result;
}

let boardsByKey: Map<string, DemoBoard> | null = null;
function DEMO_BOARDS_BY_KEY(): Map<string, DemoBoard> {
  boardsByKey ??= new Map(DEMO_BOARDS.map((board) => [board.key, board]));
  return boardsByKey;
}

/**
 * Removes the demo firm entirely, child rows first, every delete scoped to the marked org, its boards, its people
 * and the demo email domain. Returns what could not be removed rather than stopping half way.
 */
export async function resetDemoFirm(admin: Db): Promise<{ removed: boolean; problems: string[] }> {
  const orgId = await findDemoOrg(admin);
  if (!orgId) return { removed: false, problems: [] };
  const problems: string[] = [];
  const step = async (what: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await run();
    if (error) problems.push(`${what}: ${error.message}`);
  };

  // Only demo logins may be in the demo workspace when it is removed (QA of PR 291, L1): a real person's profile there
  // would lose its work. If anyone else is a member, nothing is removed and their addresses are listed.
  {
    const { data: members, error } = await admin.from("profiles").select("user_id").eq("org_id", orgId);
    if (error) return { removed: false, problems: [`reading people: ${error.message}`] };
    const outsiders: string[] = [];
    for (const member of members ?? []) {
      if (!member.user_id) continue;
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      const email = data.user?.email?.toLowerCase() ?? "";
      if (!email.endsWith("@kestrelbay.test")) outsiders.push(email || "a login with no email");
    }
    if (outsiders.length) return { removed: false, problems: [`Nothing was removed: these are members of the demo workspace and are not demo logins: ${outsiders.join(", ")}. Remove them from the workspace first.`] };
  }

  const { data: boards } = await admin.from("engagements").select("id").eq("org_id", orgId);
  const boardIds = (boards ?? []).map((row) => row.id);
  const { data: people } = await admin.from("profiles").select("id, user_id").eq("org_id", orgId);
  const profileIds = (people ?? []).map((row) => row.id);
  const { data: files } = await admin.from("work_items").select("content_ref").eq("org_id", orgId).not("content_ref", "is", null);

  // Proposals first (20 Nov): they hold the workspace's clients and people with on-delete-restrict, so while any
  // exists nothing below can go. Then everything tied to them, the agreements to texts and the people we work with.
  const loose = admin as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: proposals } = await loose.from("proposals").select("id").eq("org_id", orgId);
  const proposalIds = ((proposals ?? []) as { id: string }[]).map((row) => row.id);
  await step("proposal texts", () => loose.from("proposal_texts").delete().eq("org_id", orgId));
  if (proposalIds.length) await step("proposal documents", () => loose.from("proposal_context_items").delete().in("proposal_id", proposalIds));
  await step("proposal figures", () => loose.from("proposal_ledger").delete().eq("org_id", orgId));
  await step("proposal values", () => loose.from("proposal_ledger_values").delete().eq("org_id", orgId));
  await step("proposals", () => loose.from("proposals").delete().eq("org_id", orgId));
  await step("agreements to texts", () => loose.from("message_consents").delete().eq("org_id", orgId));
  await step("demo text number", () => loose.from("demo_text_recipients").delete().eq("org_id", orgId));
  // Their contact details go with them (on delete cascade); only roster.server.ts ever names that table.
  await step("people we work with", () => loose.from("roster_contacts").delete().eq("org_id", orgId));
  await step("invites", () => admin.from("invites").delete().eq("org_id", orgId));
  await step("client marks", () => admin.from("client_showings").delete().eq("org_id", orgId));
  await step("traced spans", () => admin.from("span_links").delete().eq("org_id", orgId));
  await step("workboards", () => admin.from("workboards").delete().eq("org_id", orgId));
  if (boardIds.length) {
    await step("decisions", () => admin.from("decisions").delete().in("engagement_id", boardIds));
    // The owner cannot leave a live board, so boards are archived before their members go.
    await step("archiving boards", () => admin.from("engagements").update({ archived_at: new Date().toISOString() }).in("id", boardIds));
    await step("members", () => admin.from("engagement_members").delete().in("engagement_id", boardIds));
    await step("tasks", () => admin.from("tasks").delete().in("engagement_id", boardIds));
  }
  await step("work", () => admin.from("work_items").delete().eq("org_id", orgId));
  await step("boards", () => admin.from("engagements").delete().eq("org_id", orgId));
  await step("clients", () => admin.from("clients").delete().eq("org_id", orgId));
  await step("notifications", () => admin.from("notifications").delete().eq("org_id", orgId));
  if (profileIds.length) {
    await step("active profiles", () => admin.from("user_active_profile").delete().in("profile_id", profileIds));
    await step("consent history", () => admin.from("data_consent_ledger").delete().in("profile_id", profileIds));
    await step("consent state", () => admin.from("data_consent_state").delete().in("profile_id", profileIds));
  }
  await step("workspace consent history", () => admin.from("data_consent_ledger").delete().eq("org_id", orgId));
  await step("workspace consent state", () => admin.from("data_consent_state").delete().eq("org_id", orgId));
  await step("people", () => admin.from("profiles").delete().eq("org_id", orgId));
  await step("workspace", () => admin.from("orgs").delete().eq("id", orgId));

  const paths = (files ?? []).map((row) => row.content_ref).filter((path): path is string => Boolean(path));
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from("work-files").remove(paths.slice(i, i + 100));
    if (error) problems.push(`files: ${error.message}`);
  }
  for (const person of people ?? []) {
    if (!person.user_id) continue;
    const { data } = await admin.auth.admin.getUserById(person.user_id);
    // Only ever a demo-domain login.
    if (data.user?.email?.toLowerCase().endsWith("@kestrelbay.test")) {
      const { error } = await admin.auth.admin.deleteUser(person.user_id);
      if (error) problems.push(`login ${data.user.email}: ${error.message}`);
    }
  }
  return { removed: problems.length === 0, problems };
}

/**
 * Adds what a board's data gained after it was seeded (17 Nov: past proposals, planted notes, SOW terms), matched by
 * title so a rerun adds nothing twice: meta on existing items, new team members, and new items with their card in the
 * next free slot of their frame, placement and client marks. A frame that needs another row grows, and whatever sits
 * below it moves down by the same amount.
 */
async function topUpBoard(admin: Db, orgId: string, board: DemoBoard, workboardId: string): Promise<void> {
  const { data: rows } = await admin.from("work_items").select("id, title, meta").eq("org_id", orgId).eq("source_meta->>demo_board", board.key);
  const byTitle = new Map((rows ?? []).map((row) => [row.title, row]));
  for (const item of board.items) {
    const extra = seedMeta(board, item);
    const row = byTitle.get(item.title);
    const meta = (row?.meta ?? {}) as Record<string, Json>;
    if (!row || Object.keys(extra).every((key) => key in meta)) continue;
    const update = await admin.from("work_items").update({ meta: { ...meta, ...extra } }).eq("id", row.id);
    if (update.error) throw new Error(`updating ${item.key}: ${update.error.message}`);
    await moveSeedFees(admin, orgId, row.id, { ...meta, ...extra });
  }

  const missing = board.items.filter((item) => !byTitle.has(item.title));
  const { data: workboard } = await admin.from("workboards").select("engagement_id").eq("id", workboardId).single();
  if (!workboard) return;
  const engagementId = workboard.engagement_id;
  const { data: members } = await admin.from("engagement_members").select("profile_id").eq("engagement_id", engagementId);
  const onBoard = new Set((members ?? []).map((row) => row.profile_id));
  const people = missing.length || board.team.length > onBoard.size ? await demoPeople(admin, orgId) : null;
  if (!people) return;
  const { profileId, userId } = people;
  const owner = profileId.get(board.team[0]!)!;
  const joining = board.team.map((key) => profileId.get(key)).filter((id): id is string => Boolean(id) && !onBoard.has(id!));
  if (joining.length) {
    must(
      await admin
        .from("engagement_members")
        .insert(joining.map((profile_id) => ({ engagement_id: engagementId, profile_id, member_role: "em" as const, added_by: owner })))
        .select("profile_id"),
      `new members of ${board.key}`,
    );
  }
  if (!missing.length) return;

  const { data: tasks } = await admin.from("tasks").select("id, name, is_board_default").eq("engagement_id", engagementId);
  const defaultTask = (tasks ?? []).find((task) => task.is_board_default);
  for (const item of missing) {
    const author = profileId.get(item.author);
    const authUser = userId.get(item.author);
    if (!author || !authUser) throw new Error(`${board.key}: ${item.author} has no demo login`);
    const seeded = await seedItem(admin, orgId, board.key, item, seedMeta(board, item), author, authUser);
    if (item.placed !== false) {
      const task = (tasks ?? []).find((entry) => !entry.is_board_default && entry.name === item.section) ?? defaultTask;
      if (task) must(await admin.from("work_item_tasks").insert({ task_id: task.id, work_item_id: seeded.id }).select("work_item_id"), `placing ${item.key}`);

      const { data: frames } = await admin.from("workboard_frames").select("id, label, kind, x, y, w, h").eq("workboard_id", workboardId);
      const frame = (frames ?? []).find((entry) => entry.label === item.section);
      const { data: nodes } = await admin.from("workboard_nodes").select("id, x, y").eq("workboard_id", workboardId);
      if (frame) {
        const inside = (nodes ?? []).filter((node) => node.x >= frame.x && node.x < frame.x + frame.w && node.y >= frame.y && node.y < frame.y + frame.h);
        const slot = nextSlot(frame, inside.length);
        const grow = slot.frameH - frame.h;
        if (grow > 0) {
          const bottom = frame.y + frame.h;
          for (const below of (frames ?? []).filter((entry) => entry.y >= bottom)) {
            await admin.from("workboard_frames").update({ y: below.y + grow }).eq("id", below.id);
          }
          for (const node of (nodes ?? []).filter((entry) => entry.y >= bottom)) {
            await admin.from("workboard_nodes").update({ y: node.y + grow }).eq("id", node.id);
          }
          await admin.from("workboard_frames").update({ h: slot.frameH }).eq("id", frame.id);
        }
        must(
          await admin
            .from("workboard_nodes")
            .insert({
              workboard_id: workboardId,
              kind: "work_item",
              work_item_id: seeded.id,
              client_key: `work:${seeded.id}`,
              frame_id: frame.kind === "task" ? frame.id : null,
              x: slot.x,
              y: slot.y,
              w: CARD_W,
              h: CARD_H,
              title: item.title,
              body: "",
              author_profile_id: author,
              created_by: author,
              updated_by: author,
            })
            .select("id"),
          `card for ${item.key}`,
        );
      }
    }
    const showings = (item.shown ?? []).map((showing) => ({
      org_id: orgId,
      engagement_id: engagementId,
      work_item_id: seeded.id,
      shown_on: showing.on,
      occasion: showing.occasion,
      content_hash: seeded.hash,
      marked_by: author,
    }));
    if (showings.length) must(await admin.from("client_showings").insert(showings).select("id"), `client marks for ${item.key}`);
    if (item.type === "deck") {
      await writeSlideMaps(admin, { ...board, items: [item] }, new Map([[item.key, seeded.id]]), new Map([[item.key, seeded.hash]]), new Map([[item.key, seeded.contentRef]]));
    }
  }
}
