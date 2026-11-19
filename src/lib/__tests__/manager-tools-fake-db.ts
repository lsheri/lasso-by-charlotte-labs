/**
 * A small in-memory database for the manager tools tests (step 8). It answers the query shapes the firm reader and
 * the manager tools use, and plays the database's own rules from the two applied migrations: column grants (members
 * cannot read pinned_by or marked_by, or write either table), the read rules, the write guards, the unique and check
 * constraints, and firm_common_question_kinds with its five-person floor. The admin client skips the read rules, as
 * the service role does. Every query is logged so a test can say which client read what, and with which columns.
 */

type Row = Record<string, unknown>;

export type World = {
  orgs: { id: string; settings: { type: string } }[];
  profiles: { id: string; user_id: string; org_id: string; role: string; is_guest: boolean; deactivated_at: string | null; display_name: string; created_at: string }[];
  engagements: {
    id: string;
    org_id: string;
    owner_id: string | null;
    title: string;
    brief: string | null;
    outcome: string | null;
    created_at: string;
    shared_with_firm: boolean;
    archived_at: string | null;
    clients: { name: string; quick_folder: boolean } | null;
  }[];
  engagement_members: { engagement_id: string; profile_id: string }[];
  /** work_item_tasks joined to tasks: which board an item is placed on. */
  placements: { work_item_id: string; engagement_id: string }[];
  work_items: { id: string; org_id: string; owner_id: string; type: string; title: string; display_title: string | null; visibility: string; work_date: string | null; meta: unknown }[];
  work_item_extracts: Row[];
  client_showings: Row[];
  board_reading_pins: { id: string; org_id: string; board_id: string; thread_id: string; slot: number; pinned_by: string | null; created_at: string }[];
  firm_exemplars: { id: string; org_id: string; engagement_id: string; work_item_id: string; marked_by: string | null; created_at: string }[];
  events: { org_id: string; event_type: string; environment: string; ts: string; actor_hash: string | null; profile_id: string | null; dims: Record<string, string> }[];
  log: { client: "admin" | "user"; table: string; op: string; columns: string | null }[];
  /** Set to make the next insert into a table fail as a unique violation, as a second writer racing the first would. */
  failNextInsert: { table: string; code: string; message: string } | null;
  now: string;
};

const GRANTS: Record<string, string[]> = {
  board_reading_pins: ["id", "org_id", "board_id", "thread_id", "slot", "created_at"],
  firm_exemplars: ["id", "org_id", "engagement_id", "work_item_id", "created_at"],
};

const denied = (table: string) => ({ data: null, error: { code: "42501", message: `permission denied for table ${table}` } });

function topLevelColumns(columns: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of columns) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      out.push(current);
      current = "";
    } else current += char;
  }
  out.push(current);
  return out.map((name) => name.trim().replace(/[!(].*$/s, "")).filter(Boolean);
}

/** public.firm_role_in: the caller's role in a company workspace, or null. */
export function firmRoleIn(world: World, userId: string | null, orgId: string): string | null {
  if (!userId) return null;
  const org = world.orgs.find((entry) => entry.id === orgId);
  if (org?.settings.type !== "company") return null;
  const profile = world.profiles.find((entry) => entry.user_id === userId && entry.org_id === orgId && !entry.deactivated_at && !entry.is_guest && entry.role !== "coach");
  return profile?.role ?? null;
}

function myProfileIds(world: World, userId: string | null): Set<string> {
  return new Set(world.profiles.filter((entry) => entry.user_id === userId && !entry.deactivated_at).map((entry) => entry.id));
}

function sharedBoard(world: World, orgId: unknown, boardId: unknown): boolean {
  return world.engagements.some((entry) => entry.id === boardId && entry.org_id === orgId && entry.shared_with_firm && !entry.archived_at);
}

function placedAndOpen(world: World, orgId: unknown, boardId: unknown, itemId: unknown): boolean {
  const item = world.work_items.find((entry) => entry.id === itemId && entry.org_id === orgId);
  return Boolean(item && item.visibility !== "private" && world.placements.some((entry) => entry.work_item_id === itemId && entry.engagement_id === boardId));
}

/** public.can_read_reading_pin */
function canReadPin(world: World, userId: string | null, row: World["board_reading_pins"][number]): boolean {
  if (!firmRoleIn(world, userId, row.org_id)) return false;
  const mine = myProfileIds(world, userId);
  const board = world.engagements.find((entry) => entry.id === row.board_id && entry.org_id === row.org_id);
  if (!board) return false;
  const onBoard = (board.owner_id !== null && mine.has(board.owner_id)) || world.engagement_members.some((entry) => entry.engagement_id === board.id && mine.has(entry.profile_id));
  return onBoard && sharedBoard(world, row.org_id, row.thread_id);
}

/** public.can_read_exemplar */
function canReadExemplar(world: World, userId: string | null, row: World["firm_exemplars"][number]): boolean {
  return Boolean(firmRoleIn(world, userId, row.org_id)) && sharedBoard(world, row.org_id, row.engagement_id) && placedAndOpen(world, row.org_id, row.engagement_id, row.work_item_id);
}

/** public.firm_common_question_kinds, as the applied SQL counts. */
function commonQuestionKinds(world: World, userId: string | null, orgId: string): Row[] {
  const role = firmRoleIn(world, userId, orgId);
  if (role !== "admin" && role !== "lead") return [];
  const since = new Date(world.now).getTime() - 90 * 24 * 60 * 60 * 1000;
  const askers = new Map<string, Set<string>>();
  for (const event of world.events) {
    if (event.org_id !== orgId || event.event_type !== "firm_ask.asked" || event.environment !== "production" || !event.actor_hash) continue;
    if (new Date(event.ts).getTime() < since) continue;
    for (const source of ["topic", "starter"] as const) {
      const kind = event.dims[source] ?? "";
      if (kind === "" || kind === "none") continue;
      const key = `${source}\u0000${kind}`;
      askers.set(key, (askers.get(key) ?? new Set()).add(event.actor_hash));
    }
  }
  return [...askers]
    .filter(([, people]) => people.size >= 5)
    .map(([key, people]) => {
      const [source, kind] = key.split("\u0000");
      return { question_source: source, question_kind: kind, askers_band: people.size < 10 ? "5 to 9" : people.size < 25 ? "10 to 24" : "25 or more" };
    });
}

let nextId = 1;
const newId = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

function builder(world: World, client: "admin" | "user", userId: string | null, table: string) {
  const state: { op: string; columns: string | null; filters: { kind: "eq" | "in" | "is"; field: string; value: unknown }[]; payload: Row | null; ignoreDuplicates: boolean } = {
    op: "select",
    columns: null,
    filters: [],
    payload: null,
    ignoreDuplicates: false,
  };

  const field = (row: Row, name: string): unknown => {
    if (table === "work_item_tasks") {
      if (name === "tasks.engagement_id") return row["engagement_id"];
      if (name === "work_items.visibility") return world.work_items.find((item) => item.id === row["work_item_id"])?.visibility;
    }
    return row[name];
  };
  const matches = (row: Row) =>
    state.filters.every((filter) => {
      const value = field(row, filter.field);
      if (filter.kind === "in") return (filter.value as unknown[]).includes(value);
      if (filter.kind === "is") return (value ?? null) === filter.value;
      return value === filter.value;
    });

  const source = (): Row[] => {
    if (table === "work_item_tasks") return world.placements as unknown as Row[];
    const rows = (world as unknown as Record<string, Row[] | undefined>)[table];
    if (!rows) throw new Error(`fake db: no table ${table}`);
    return rows;
  };

  function select(): { data: Row[] | null; error: { code?: string; message: string } | null } {
    const columns = state.columns ?? "*";
    const names = topLevelColumns(columns);
    if (client === "user") {
      const granted = GRANTS[table];
      if (granted && (columns.trim() === "*" || names.some((name) => !granted.includes(name)))) return denied(table);
      if (table === "events") return { data: [], error: null };
      if (!granted && table !== "profiles") throw new Error(`fake db: the user's client is not expected to read ${table}`);
    }
    let rows = source().filter(matches);
    if (client === "user") {
      if (table === "profiles") rows = rows.filter((row) => row["user_id"] === userId);
      if (table === "board_reading_pins") rows = rows.filter((row) => canReadPin(world, userId, row as never));
      if (table === "firm_exemplars") rows = rows.filter((row) => canReadExemplar(world, userId, row as never));
    }
    if (table === "work_item_tasks") return { data: rows.map((row) => ({ work_item_id: row["work_item_id"], tasks: { engagement_id: row["engagement_id"] } })), error: null };
    if (columns.trim() === "*") return { data: rows.map((row) => ({ ...row })), error: null };
    return { data: rows.map((row) => Object.fromEntries(names.map((name) => [name, row[name]]))), error: null };
  }

  function insert(): { data: null; error: { code?: string; message: string } | null } {
    if (client === "user") return denied(table);
    const row = state.payload!;
    if (world.failNextInsert?.table === table) {
      const { code, message } = world.failNextInsert;
      world.failNextInsert = null;
      return { data: null, error: { code, message } };
    }
    if (table === "board_reading_pins") {
      const slot = row["slot"] as number;
      if (!(slot >= 1 && slot <= 3)) return { data: null, error: { code: "23514", message: 'new row violates check constraint "board_reading_pins_slot_check"' } };
      if (row["board_id"] === row["thread_id"]) return { data: null, error: { code: "23514", message: 'new row violates check constraint "board_reading_pins_not_self"' } };
      if (world.orgs.find((org) => org.id === row["org_id"])?.settings.type !== "company") return { data: null, error: { code: "P0001", message: "reading lists are for company workspaces" } };
      if (!world.engagements.some((board) => board.id === row["board_id"] && board.org_id === row["org_id"])) return { data: null, error: { code: "P0001", message: "that board is not in this workspace" } };
      if (!sharedBoard(world, row["org_id"], row["thread_id"])) return { data: null, error: { code: "P0001", message: "only a thread shared with the firm can be pinned" } };
      if (world.board_reading_pins.some((pin) => pin.board_id === row["board_id"] && (pin.slot === slot || pin.thread_id === row["thread_id"]))) {
        return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      world.board_reading_pins.push({ id: newId(), created_at: world.now, ...(row as Omit<World["board_reading_pins"][number], "id" | "created_at" | "pinned_by">), pinned_by: (row["pinned_by"] as string | null | undefined) ?? null });
      return { data: null, error: null };
    }
    if (table === "firm_exemplars") {
      if (!sharedBoard(world, row["org_id"], row["engagement_id"])) return { data: null, error: { code: "P0001", message: "only work on a board shared with the firm can be an exemplar" } };
      if (!placedAndOpen(world, row["org_id"], row["engagement_id"], row["work_item_id"])) return { data: null, error: { code: "P0001", message: "that work is not on this board" } };
      const there = world.firm_exemplars.some((mark) => mark.engagement_id === row["engagement_id"] && mark.work_item_id === row["work_item_id"]);
      if (there) return state.ignoreDuplicates ? { data: null, error: null } : { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      world.firm_exemplars.push({ id: newId(), created_at: world.now, ...(row as Omit<World["firm_exemplars"][number], "id" | "created_at" | "marked_by">), marked_by: (row["marked_by"] as string | null | undefined) ?? null });
      return { data: null, error: null };
    }
    throw new Error(`fake db: no insert into ${table}`);
  }

  function remove(): { data: null; error: { code?: string; message: string } | null } {
    if (client === "user") return denied(table);
    if (table !== "board_reading_pins" && table !== "firm_exemplars") throw new Error(`fake db: no delete from ${table}`);
    const rows = world[table] as unknown as Row[];
    const keep = rows.filter((row) => !matches(row));
    rows.length = 0;
    rows.push(...keep);
    return { data: null, error: null };
  }

  const run = async () => {
    world.log.push({ client, table, op: state.op, columns: state.columns });
    if (state.op === "select") return select();
    if (state.op === "insert" || state.op === "upsert") return insert();
    if (state.op === "delete") return remove();
    if (client === "user") return denied(table);
    throw new Error(`fake db: no ${state.op} on ${table}`);
  };

  const api = {
    select(columns = "*") {
      state.columns = columns;
      return api;
    },
    insert(payload: Row) {
      state.op = "insert";
      state.payload = payload;
      return api;
    },
    upsert(payload: Row, options?: { ignoreDuplicates?: boolean }) {
      state.op = "upsert";
      state.payload = payload;
      state.ignoreDuplicates = options?.ignoreDuplicates === true;
      return api;
    },
    update(payload: Row) {
      state.op = "update";
      state.payload = payload;
      return api;
    },
    delete() {
      state.op = "delete";
      return api;
    },
    eq(name: string, value: unknown) {
      state.filters.push({ kind: "eq", field: name, value });
      return api;
    },
    in(name: string, value: unknown[]) {
      state.filters.push({ kind: "in", field: name, value });
      return api;
    },
    is(name: string, value: unknown) {
      state.filters.push({ kind: "is", field: name, value });
      return api;
    },
    order() {
      return api;
    },
    maybeSingle: async () => {
      const result = await run();
      return { data: Array.isArray(result.data) ? (result.data[0] ?? null) : null, error: result.error };
    },
    then<A, B>(ok: (value: Awaited<ReturnType<typeof run>>) => A, fail?: (reason: unknown) => B) {
      return run().then(ok, fail);
    },
  };
  return api;
}

/** A client as the server sees it: the service role ("admin", no signed-in user) or one signed-in person. */
export function fakeClient(world: World, client: "admin" | "user", userId: string | null = null) {
  return {
    from: (table: string) => builder(world, client, client === "admin" ? null : userId, table),
    rpc: async (name: string, args: { p_org: string }) => {
      world.log.push({ client, table: `rpc:${name}`, op: "rpc", columns: null });
      if (name !== "firm_common_question_kinds") throw new Error(`fake db: no function ${name}`);
      return { data: commonQuestionKinds(world, client === "admin" ? null : userId, args.p_org), error: null };
    },
  };
}
