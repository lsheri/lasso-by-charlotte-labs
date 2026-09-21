import { describe, expect, it, vi } from "vitest";
import { createMiddleware } from "@tanstack/react-start";
import { runWithStartContext } from "@tanstack/start-storage-context";

const rows: Record<string, Record<string, unknown>[]> = {
  profiles: [{ id: "p1", org_id: "o1", role: "em", user_id: "u1", deactivated_at: null }],
  work_items: [{ id: "w1", owner_id: "p1", title: "Deck", type: "deck", source_vendor: null, work_date: null, captured_at: "2026-01-01", org_id: "o1" }],
  turns: [{ work_item_id: "w1", turn_no: 1, role: "user", content: "pricing ladder talk" }],
  board_documents: [{ id: "d1", task_id: "t1", title: "Note", content: { text: "zarquon pricing" } }],
};
const touched: string[] = [];
function builder(table: string) {
  touched.push(table);
  const api: Record<string, unknown> = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === "then") return (r: (v: unknown) => unknown) => Promise.resolve(r({ data: rows[table] ?? [], error: null }));
      if (prop === "maybeSingle") return () => Promise.resolve({ data: (rows[table] ?? [])[0] ?? null, error: null });
      return () => api;
    },
  });
  return api;
}
const stub = { from: (t: string) => builder(t) };

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: createMiddleware({ type: "function" }).server(({ next }: { next: (o: unknown) => unknown }) =>
    next({ context: { supabase: stub, userId: "u1", claims: {} } }),
  ),
}));

import { searchRecord } from "@/lib/find-it.functions";

describe("probe", () => {
  it("runs", async () => {
    const out = await runWithStartContext({ getRouter: () => ({}), request: new Request("http://localhost/"), startOptions: {}, contextAfterGlobalMiddlewares: {}, executedRequestMiddlewares: new Set(), handlerType: "serverFn" } as never, () => (searchRecord as unknown as { __executeServer: (o: unknown) => Promise<unknown> }).__executeServer({
      data: { query: "zarquon", mode: "thread" },
      method: "POST",
    }));
    console.log(JSON.stringify(out), touched);
    expect(1).toBe(1);
  });
});
