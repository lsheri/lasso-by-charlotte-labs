/**
 * A tiny stand-in for the Supabase client in server tests: every chained call is recorded, and one function decides
 * what each finished query returns. Enough for select, update and upsert chains awaited directly or ended with
 * maybeSingle, single or limit.
 */
export type FakeQuery = {
  table: string;
  op: "select" | "update" | "upsert" | "insert" | "delete";
  columns: string | null;
  payload: unknown;
  filters: { kind: string; column: string; value: unknown }[];
  /** True when the caller asked for one row (maybeSingle or single). */
  one: boolean;
};

export type FakeResult = { data: unknown; error: { message: string } | null };

export function fakeTableDb(answer: (query: FakeQuery) => FakeResult | Promise<FakeResult>) {
  const queries: FakeQuery[] = [];
  const from = (table: string) => {
    const query: FakeQuery = { table, op: "select", columns: null, payload: null, filters: [], one: false };
    queries.push(query);
    const run = () => Promise.resolve(answer(query));
    const chain: Record<string, unknown> = {
      select: (columns?: string) => {
        query.columns = columns ?? "*";
        return chain;
      },
      update: (payload: unknown) => {
        query.op = "update";
        query.payload = payload;
        return chain;
      },
      upsert: (payload: unknown) => {
        query.op = "upsert";
        query.payload = payload;
        return chain;
      },
      insert: (payload: unknown) => {
        query.op = "insert";
        query.payload = payload;
        return chain;
      },
      delete: () => {
        query.op = "delete";
        return chain;
      },
      maybeSingle: () => {
        query.one = true;
        return run();
      },
      single: () => {
        query.one = true;
        return run();
      },
      then: (resolve: (value: FakeResult) => unknown, reject?: (reason: unknown) => unknown) => run().then(resolve, reject),
    };
    for (const kind of ["eq", "in", "is", "neq"]) {
      chain[kind] = (column: string, value: unknown) => {
        query.filters.push({ kind, column, value });
        return chain;
      };
    }
    chain["limit"] = () => chain;
    chain["order"] = () => chain;
    return chain;
  };
  return { db: { from } as never, queries };
}

/** The value of one eq filter on a recorded query, or undefined. */
export function eqOf(query: FakeQuery, column: string): unknown {
  return query.filters.find((filter) => filter.kind === "eq" && filter.column === column)?.value;
}
