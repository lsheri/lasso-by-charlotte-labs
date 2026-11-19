// 19 Nov, demo tour: the one function the reset uses to remove marks on a board. It lives in the firm brain's file so
// firm_exemplars is still read only where the firm brain's guard says.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { clearBoardExemplars } from "../manager-tools.server";

function fake(result: { data: unknown; error: { message: string } | null }) {
  const seen: unknown[][] = [];
  const chain: Record<string, unknown> = {};
  for (const name of ["delete", "eq", "select"]) chain[name] = (...args: unknown[]) => (seen.push([name, ...args]), chain);
  chain["then"] = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  const from = vi.fn((table: string) => (seen.push(["from", table]), chain));
  return { admin: { from } as never, seen };
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("clearBoardExemplars", () => {
  it("deletes marks for one board in one workspace, and nothing wider", async () => {
    const { admin, seen } = fake({ data: [{ id: "a" }, { id: "b" }], error: null });
    expect(await clearBoardExemplars(admin, "org-1", "board-1")).toEqual({ removed: 2, error: null });
    expect(seen).toEqual([["from", "firm_exemplars"], ["delete"], ["eq", "org_id", "org-1"], ["eq", "engagement_id", "board-1"], ["select", "id"]]);
  });

  it("reports none removed when there were none, and passes an error on", async () => {
    expect(await clearBoardExemplars(fake({ data: [], error: null }).admin, "o", "b")).toEqual({ removed: 0, error: null });
    expect(await clearBoardExemplars(fake({ data: null, error: { message: "refused" } }).admin, "o", "b")).toEqual({ removed: 0, error: { message: "refused" } });
  });

  it("is called only by the demo tour's founder-only reset", () => {
    const callers = sources("src").filter((file) => file !== "src/lib/manager-tools.server.ts" && readFileSync(file, "utf8").includes("clearBoardExemplars"));
    expect(callers).toEqual(["src/lib/demo-firm/tour.server.ts"]);
    const functions = readFileSync("src/lib/manager-tools.functions.ts", "utf8");
    expect(functions).not.toContain("clearBoardExemplars");
  });
});
