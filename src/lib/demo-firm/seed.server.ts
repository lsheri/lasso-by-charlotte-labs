import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";

import { DEMO_PEOPLE, demoEmail } from "./people";
import { CARD_H, CARD_W, fileNameFor, nextSlot, outcomeLine, planBoard, sectionTop, seedMeta, slideMap, sourceFor } from "./plan";
import type { DemoBoard, DemoFirm, DemoItem } from "./types";

type Db = SupabaseClient<Database>;

/** The marker on the demo org, so a second run refuses and a reset can only ever touch this one workspace. */
export const DEMO_FIRM_MARKER = "kestrel-bay";

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
  return { orgId: org.id, people: firm.people.length };
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
export async function finishDemoSeed(admin: Db): Promise<void> {
  const orgId = await findDemoOrg(admin);
  if (!orgId) return;
  // Each demo person has said they use the app for work, so Home skips the first-use question.
  const { userId } = await demoPeople(admin, orgId);
  const rows = [...userId.values()].map((user_id) => ({ user_id, uses: ["work"], uses_declared_at: new Date().toISOString() }));
  if (rows.length) {
    const uses = await admin.from("people").upsert(rows, { onConflict: "user_id" });
    if (uses.error) throw new Error(`recording uses: ${uses.error.message}`);
  }
  const { error } = await admin.from("notifications").delete().eq("org_id", orgId);
  if (error) throw new Error(`clearing notifications: ${error.message}`);
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
  return { id: row.id, hash, contentRef };
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

  const { data: boards } = await admin.from("engagements").select("id").eq("org_id", orgId);
  const boardIds = (boards ?? []).map((row) => row.id);
  const { data: people } = await admin.from("profiles").select("id, user_id").eq("org_id", orgId);
  const profileIds = (people ?? []).map((row) => row.id);
  const { data: files } = await admin.from("work_items").select("content_ref").eq("org_id", orgId).not("content_ref", "is", null);

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
