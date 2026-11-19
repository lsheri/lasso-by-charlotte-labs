/**
 * An in-memory stand-in for the two Supabase clients the proposal ledger uses, for tests only (local dev has no
 * service key, so nothing here can reach a database). One store, two views of it:
 *
 * - the admin client sees and writes everything, and enforces what the applied migration enforces on a write: the
 *   kind list, the counts-by-kind check, the three unique indexes and the guard trigger;
 * - a user client reads only what the applied read rules would return (can_read_proposal_ledger, firm_role_in, board
 *   membership) and is refused every write to the ledger tables, as the grants refuse it.
 *
 * Every call is logged with the client that made it, so a test can assert which client read what.
 */

type Row = Record<string, unknown>;
export type Store = Record<string, Row[]>;
export type Call = { client: "admin" | "user"; table: string; op: "select" | "insert" | "update" | "upsert" | "delete" };
type Failure = "error" | "throw" | "hang";

const ONCE_KINDS = ["brief_received", "questions_sent", "answers_received", "sent_to_client", "won", "lost"];
const KINDS = [...ONCE_KINDS, "draft_completed", "red_pen_run"];

let seq = 0;
export function uuid(tag = 0): string {
  seq += 1;
  return `${String(tag).padStart(8, "0")}-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

export class FakeLedger {
  store: Store;
  calls: Call[] = [];
  private failures = new Map<string, Failure>();

  constructor(store: Store) {
    this.store = store;
    for (const table of ["proposal_ledger", "proposal_ledger_values", "client_showings", "analysis_runs", "work_items", "engagement_members"]) this.store[table] ??= [];
  }

  /** Make every call of one kind on one table fail, throw or never return. */
  failOn(client: "admin" | "user", table: string, op: Call["op"], how: Failure) {
    this.failures.set(`${client}:${table}:${op}`, how);
  }

  failure(client: "admin" | "user", table: string, op: Call["op"]): Failure | undefined {
    return this.failures.get(`${client}:${table}:${op}`);
  }

  rows(table: string): Row[] {
    return (this.store[table] ??= []);
  }

  admin() {
    return makeClient(this, null);
  }

  as(userId: string) {
    return makeClient(this, userId);
  }

  /* ---- what the database's own functions answer ---- */

  private profilesOf(userId: string): Row[] {
    return this.rows("profiles").filter((profile) => profile["user_id"] === userId);
  }

  /** firm_role_in: null for guests, coaches, deactivated people, other workspaces and non-company workspaces. */
  firmRoleIn(userId: string, orgId: string): string | null {
    const org = this.rows("orgs").find((row) => row["id"] === orgId);
    if ((org?.["settings"] as { type?: string } | null)?.type !== "company") return null;
    const profile = this.profilesOf(userId).find((row) => row["org_id"] === orgId && !row["deactivated_at"] && !row["is_guest"] && row["role"] !== "coach");
    return (profile?.["role"] as string | undefined) ?? null;
  }

  private isMine(userId: string, profileId: unknown): boolean {
    return this.profilesOf(userId).some((profile) => profile["id"] === profileId);
  }

  private onBoard(userId: string, engagementId: unknown): boolean {
    const board = this.rows("engagements").find((row) => row["id"] === engagementId);
    if (!board) return false;
    if (this.isMine(userId, board["owner_id"])) return true;
    return this.rows("engagement_members").some((member) => member["engagement_id"] === engagementId && this.isMine(userId, member["profile_id"]));
  }

  /** can_read_proposal_ledger(org, engagement, fee), as applied. */
  canReadLedger(userId: string, orgId: unknown, engagementId: unknown, fee: boolean): boolean {
    const board = this.rows("engagements").find((row) => row["id"] === engagementId && row["org_id"] === orgId);
    if (!board) return false;
    const role = this.firmRoleIn(userId, orgId as string);
    if (!role) return false;
    const partner = role === "admin" || role === "lead";
    if (fee && !partner) return false;
    return this.isMine(userId, board["owner_id"]) || (partner && board["shared_with_firm"] === true && !board["archived_at"]);
  }

  visible(userId: string, table: string, row: Row): boolean {
    switch (table) {
      case "profiles":
        return row["user_id"] === userId;
      case "engagements":
        return this.onBoard(userId, row["id"]);
      case "engagement_members":
      case "client_showings":
        return this.onBoard(userId, row["engagement_id"]);
      case "work_items":
        return this.isMine(userId, row["owner_id"]) || this.onBoard(userId, row["_engagement_id"]);
      case "analysis_runs":
        return this.isMine(userId, row["owner_id"]);
      case "proposal_ledger":
        return this.canReadLedger(userId, row["org_id"], row["engagement_id"], false);
      case "proposal_ledger_values":
        return this.canReadLedger(userId, row["org_id"], row["engagement_id"], true);
      default:
        return false;
    }
  }

  /** What the migration checks when a ledger row is written. Returns a Postgres-style error, or null. */
  checkLedgerWrite(table: string, next: Row, existing: Row[]): { code: string; message: string } | null {
    const org = this.rows("orgs").find((row) => row["id"] === next["org_id"]);
    if ((org?.["settings"] as { type?: string } | null)?.type !== "company") return { code: "P0001", message: "the proposal ledger is for company workspaces" };
    if (!this.rows("engagements").some((row) => row["id"] === next["engagement_id"] && row["org_id"] === next["org_id"])) return { code: "P0001", message: "that board is not in this workspace" };
    if (table === "proposal_ledger_values") {
      if (!(Number(next["amount"]) >= 0) || !/^[A-Z]{3}$/.test(String(next["currency"]))) return { code: "23514", message: "check" };
      return null;
    }
    const kind = String(next["kind"]);
    if (!KINDS.includes(kind)) return { code: "23514", message: "kind" };
    const draftCounts = ["sections_total", "sections_sourced", "questions_prepared"].some((key) => next[key] != null);
    if ((kind !== "draft_completed" && draftCounts) || (kind !== "red_pen_run" && next["claims_unsupported"] != null)) return { code: "23514", message: "counts_by_kind" };
    if (next["sections_sourced"] != null && (next["sections_total"] == null || Number(next["sections_sourced"]) > Number(next["sections_total"]))) return { code: "23514", message: "sourced_within_total" };
    const others = existing.filter((row) => row["id"] !== next["id"]);
    const sameBoard = others.filter((row) => row["engagement_id"] === next["engagement_id"]);
    if (ONCE_KINDS.includes(kind) && sameBoard.some((row) => row["kind"] === kind)) return { code: "23505", message: "proposal_ledger_once_idx" };
    if ((kind === "won" || kind === "lost") && sameBoard.some((row) => row["kind"] === "won" || row["kind"] === "lost")) return { code: "23505", message: "proposal_ledger_outcome_idx" };
    if (next["source_ref"] != null && others.some((row) => row["kind"] === kind && row["source_ref"] === next["source_ref"])) return { code: "23505", message: "proposal_ledger_source_idx" };
    return null;
  }
}

type Result = { data: unknown; error: { code: string; message: string } | null };

function makeClient(db: FakeLedger, userId: string | null) {
  const client: "admin" | "user" = userId === null ? "admin" : "user";
  return {
    from(table: string) {
      const state = {
        op: "select" as Call["op"],
        filters: [] as ((row: Row) => boolean)[],
        orders: [] as { column: string; ascending: boolean }[],
        limit: null as number | null,
        range: null as [number, number] | null,
        payload: null as Row | Row[] | null,
        single: null as "maybe" | "one" | null,
        returning: false,
      };

      const run = async (): Promise<Result> => {
        db.calls.push({ client, table, op: state.op });
        const how = db.failure(client, table, state.op);
        if (how === "hang") return new Promise<Result>(() => {});
        if (how === "throw") throw new Error("network down");
        if (how === "error") return { data: null, error: { code: "XX000", message: "boom" } };
        const all = db.rows(table);
        const ledger = table === "proposal_ledger" || table === "proposal_ledger_values";
        if (state.op !== "select" && ledger && userId !== null) return { data: null, error: { code: "42501", message: `permission denied for table ${table}` } };
        const matches = (row: Row) => state.filters.every((filter) => filter(row)) && (userId === null || db.visible(userId, table, row));
        let out: Row[] = [];

        if (state.op === "select") {
          out = all.filter(matches);
        } else if (state.op === "insert" || state.op === "upsert") {
          const incoming = Array.isArray(state.payload) ? state.payload : [state.payload as Row];
          for (const raw of incoming) {
            const key = table === "proposal_ledger_values" ? "engagement_id" : "id";
            const next: Row = table === "proposal_ledger" ? { id: uuid(9), source_ref: null, sections_total: null, sections_sourced: null, questions_prepared: null, claims_unsupported: null, occurred_at: new Date().toISOString(), ...raw } : { ...raw };
            const current = state.op === "upsert" ? all.find((row) => row[key] === next[key]) : undefined;
            if (ledger) {
              const problem = db.checkLedgerWrite(table, next, current ? all.filter((row) => row !== current) : all);
              if (problem) return { data: null, error: problem };
              if (!current && table === "proposal_ledger_values" && all.some((row) => row[key] === next[key])) return { data: null, error: { code: "23505", message: "proposal_ledger_values_pkey" } };
            }
            if (current) Object.assign(current, next);
            else all.push(next);
            out.push(current ?? next);
          }
        } else if (state.op === "update") {
          for (const row of all.filter(matches)) {
            const next = { ...row, ...(state.payload as Row) };
            if (ledger) {
              const problem = db.checkLedgerWrite(table, next, all);
              if (problem) return { data: null, error: problem };
            }
            Object.assign(row, next);
            out.push(row);
          }
        } else {
          out = all.filter(matches);
          db.store[table] = all.filter((row) => !out.includes(row));
        }

        for (const order of [...state.orders].reverse()) {
          out = [...out].sort((a, b) => String(a[order.column] ?? "").localeCompare(String(b[order.column] ?? "")) * (order.ascending ? 1 : -1));
        }
        if (state.range) out = out.slice(state.range[0], state.range[1] + 1);
        if (state.limit !== null) out = out.slice(0, state.limit);
        const copies = out.map((row) => ({ ...row }));
        if (state.single) {
          if (state.single === "one" && copies.length !== 1) return { data: null, error: { code: "PGRST116", message: "not one row" } };
          return { data: copies[0] ?? null, error: null };
        }
        return { data: state.op === "select" || state.returning ? copies : null, error: null };
      };

      const builder = {
        select(_columns?: string) {
          if (state.op !== "select") state.returning = true;
          return builder;
        },
        insert(payload: Row | Row[]) {
          state.op = "insert";
          state.payload = payload;
          return builder;
        },
        upsert(payload: Row | Row[], _options?: unknown) {
          state.op = "upsert";
          state.payload = payload;
          return builder;
        },
        update(payload: Row) {
          state.op = "update";
          state.payload = payload;
          return builder;
        },
        delete() {
          state.op = "delete";
          return builder;
        },
        eq(column: string, value: unknown) {
          state.filters.push((row) => row[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          state.filters.push((row) => values.includes(row[column]));
          return builder;
        },
        is(column: string, value: unknown) {
          state.filters.push((row) => (row[column] ?? null) === value);
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          state.orders.push({ column, ascending: options?.ascending !== false });
          return builder;
        },
        limit(count: number) {
          state.limit = count;
          return builder;
        },
        range(from: number, to: number) {
          state.range = [from, to];
          return builder;
        },
        maybeSingle() {
          state.single = "maybe";
          return run();
        },
        single() {
          state.single = "one";
          return run();
        },
        then<A, B>(resolve: (value: Result) => A, reject?: (reason: unknown) => B) {
          return run().then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

/* ---- a small firm to test with ---- */

export const ORG = "00000001-0000-4000-8000-000000000001";
export const OTHER_ORG = "00000002-0000-4000-8000-000000000002";
export const SHARED_BOARD = "0000000b-0000-4000-8000-000000000001";
export const UNSHARED_BOARD = "0000000b-0000-4000-8000-000000000002";
export const ADMIN_OWN_UNSHARED = "0000000b-0000-4000-8000-000000000003";
export const OTHER_ORG_BOARD = "0000000b-0000-4000-8000-000000000004";
export const DRAFT_ITEM = "0000000d-0000-4000-8000-000000000001";
export const PROPOSAL_ITEM = "0000000d-0000-4000-8000-000000000002";
export const DECK_ITEM = "0000000d-0000-4000-8000-000000000003";

export type Person = { userId: string; profileId: string; role: string };
const person = (n: number, role: string): Person => ({ userId: `0000000a-0000-4000-8000-00000000000${n}`, profileId: `0000000c-0000-4000-8000-00000000000${n}`, role });

/** owner: an em who owns both proposal boards. editor: an em on the boards. nonMember: an em on neither. */
export const PEOPLE = {
  admin: person(1, "admin"),
  lead: person(2, "lead"),
  owner: person(3, "em"),
  editor: person(4, "em"),
  nonMember: person(5, "em"),
  coach: person(6, "coach"),
  guest: person(7, "em"),
  outsider: person(8, "admin"),
} as const;
export type PersonKey = keyof typeof PEOPLE;

export function firm(): FakeLedger {
  const profiles = (Object.entries(PEOPLE) as [PersonKey, Person][]).map(([key, who], index) => ({
    id: who.profileId,
    user_id: who.userId,
    org_id: key === "outsider" ? OTHER_ORG : ORG,
    role: who.role,
    is_guest: key === "guest",
    deactivated_at: null,
    created_at: `2026-01-0${index + 1}T00:00:00Z`,
  }));
  const board = (id: string, org: string, owner: Person, shared: boolean) => ({ id, org_id: org, owner_id: owner.profileId, shared_with_firm: shared, archived_at: null, outcome: null, title: "Board" });
  const member = (engagement: string, who: Person, role = "editor") => ({ engagement_id: engagement, profile_id: who.profileId, member_role: role });
  return new FakeLedger({
    orgs: [
      { id: ORG, settings: { type: "company" } },
      { id: OTHER_ORG, settings: { type: "company" } },
    ],
    profiles,
    engagements: [
      board(SHARED_BOARD, ORG, PEOPLE.owner, true),
      board(UNSHARED_BOARD, ORG, PEOPLE.owner, false),
      board(ADMIN_OWN_UNSHARED, ORG, PEOPLE.admin, false),
      board(OTHER_ORG_BOARD, OTHER_ORG, PEOPLE.outsider, true),
    ],
    engagement_members: [
      ...[SHARED_BOARD, UNSHARED_BOARD].flatMap((id) => [member(id, PEOPLE.owner), member(id, PEOPLE.editor), member(id, PEOPLE.coach, "coach"), member(id, PEOPLE.guest)]),
      member(UNSHARED_BOARD, PEOPLE.admin),
      member(ADMIN_OWN_UNSHARED, PEOPLE.admin),
      member(OTHER_ORG_BOARD, PEOPLE.outsider),
    ],
    work_items: [
      { id: DRAFT_ITEM, owner_id: PEOPLE.owner.profileId, title: "Proposal draft: Marrowfield", display_title: null, meta: { deliverable_kind: "proposal" }, _engagement_id: UNSHARED_BOARD },
      { id: PROPOSAL_ITEM, owner_id: PEOPLE.owner.profileId, title: "Proposal", display_title: null, meta: { deliverable_kind: "proposal" }, _engagement_id: SHARED_BOARD },
      { id: DECK_ITEM, owner_id: PEOPLE.owner.profileId, title: "Steering deck", display_title: null, meta: { deliverable_kind: "deck" }, _engagement_id: SHARED_BOARD },
    ],
  });
}
