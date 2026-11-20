import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { carriesFees, feesOf, metaWithFees, termsWithoutFees } from "@/lib/sow-terms-shared";
import { readFeeTerms, storeSowTerms, withFeeTerms } from "@/lib/fee-terms.server";
import { sowFacts } from "@/lib/demo-firm/plan";

/** F2 (QA of PR 273): Members never receive a fee figure; the server puts fees back only for its own gated readers. */

type Call = { table: string; op: string; args: unknown[] };

function fakeAdmin(opts: { missing?: boolean; rows?: { work_item_id: string; fee_text: string; fee_amount: string | null }[] } = {}) {
  const calls: Call[] = [];
  const missingError = { code: "PGRST205", message: "Could not find the table 'public.work_item_fee_terms' in the schema cache" };
  const result = (data: unknown) => Promise.resolve(opts.missing ? { data: null, error: missingError } : { data, error: null });
  return {
    calls,
    from(table: string) {
      return {
        select: (...args: unknown[]) => ({
          in: (column: string, ids: string[]) => {
            calls.push({ table, op: "select", args: [...args, column, ids] });
            return result((opts.rows ?? []).filter((row) => ids.includes(row.work_item_id)));
          },
        }),
        upsert: (...args: unknown[]) => {
          calls.push({ table, op: "upsert", args });
          return result(null);
        },
        delete: () => ({
          eq: (...args: unknown[]) => {
            calls.push({ table, op: "delete", args });
            return result(null);
          },
        }),
      };
    },
  };
}

const facts = { fee_text: "$380k", fee_amount: 380000, fee_basis: "fixed", weeks: 14, confirmed_by: "p1", confirmed_at: "2026-11-18T00:00:00Z" };

describe("the pure rules", () => {
  it("splits the money from the rest of the terms and puts it back", () => {
    const rest = termsWithoutFees(facts);
    expect(rest).toEqual({ fee_basis: "fixed", weeks: 14, confirmed_by: "p1", confirmed_at: "2026-11-18T00:00:00Z" });
    expect(carriesFees({ sow_facts: rest })).toBe(false);
    expect(feesOf(facts)).toEqual({ fee_text: "$380k", fee_amount: 380000 });
    expect(metaWithFees({ sow_facts: rest, mime_type: "text/markdown" }, feesOf(facts))).toEqual({ sow_facts: { ...rest, fee_text: "$380k", fee_amount: 380000 }, mime_type: "text/markdown" });
  });

  it("finds a fee anywhere in an answer, so a role test can inspect a whole response", () => {
    expect(carriesFees([{ id: "a", meta: { sow_facts: facts } }])).toBe(true);
    expect(carriesFees([{ id: "a", meta: { sow_facts: termsWithoutFees(facts) } }])).toBe(false);
    expect(carriesFees(null)).toBe(false);
  });

  it("leaves meta alone when there are no fees or no terms", () => {
    const meta = { sow_facts: { weeks: 3 } };
    expect(metaWithFees(meta, null)).toBe(meta);
    expect(metaWithFees({ deliverable_kind: "proposal" }, { fee_text: "$1k", fee_amount: 1000 })).toEqual({ deliverable_kind: "proposal" });
  });
});

describe("saving terms", () => {
  it("puts the fee in the server-only table and keeps none in meta", async () => {
    const admin = fakeAdmin();
    const meta = await storeSowTerms(admin as never, { itemId: "i1", orgId: "o1", meta: { mime_type: "text/markdown" }, facts });
    expect(carriesFees(meta)).toBe(false);
    expect(meta).toEqual({ mime_type: "text/markdown", sow_facts: termsWithoutFees(facts) });
    const upsert = admin.calls.find((call) => call.op === "upsert");
    expect(upsert?.table).toBe("work_item_fee_terms");
    expect(upsert?.args[0]).toMatchObject({ work_item_id: "i1", org_id: "o1", fee_text: "$380k", fee_amount: 380000 });
  });

  it("clears the terms and the fee row together", async () => {
    const admin = fakeAdmin();
    const meta = await storeSowTerms(admin as never, { itemId: "i1", orgId: "o1", meta: { sow_facts: termsWithoutFees(facts), x: 1 }, facts: null });
    expect(meta).toEqual({ x: 1 });
    expect(admin.calls).toEqual([{ table: "work_item_fee_terms", op: "delete", args: ["work_item_id", "i1"] }]);
  });

  it("keeps the old place until the table exists, so nothing breaks before the SQL is pasted", async () => {
    const admin = fakeAdmin({ missing: true });
    const meta = await storeSowTerms(admin as never, { itemId: "i1", orgId: "o1", meta: {}, facts });
    expect(meta).toEqual({ sow_facts: facts });
  });

  it("fails loudly on any other database error", async () => {
    const admin = fakeAdmin();
    admin.from = () => ({ upsert: () => Promise.resolve({ error: { code: "42501", message: "permission denied" } }) }) as never;
    await expect(storeSowTerms(admin as never, { itemId: "i1", orgId: "o1", meta: {}, facts })).rejects.toThrow("permission denied");
  });
});

describe("reading terms on the server", () => {
  it("puts fees back only on SOW items, reading only their ids", async () => {
    const admin = fakeAdmin({ rows: [{ work_item_id: "sow", fee_text: "$380k", fee_amount: "380000" }] });
    const items = await withFeeTerms(admin as never, [
      { id: "sow", meta: { sow_facts: termsWithoutFees(facts) } },
      { id: "deck", meta: { deliverable_kind: "proposal" } },
    ]);
    expect(items[0]!.meta).toEqual({ sow_facts: { ...termsWithoutFees(facts), fee_text: "$380k", fee_amount: 380000 } });
    expect(items[1]!.meta).toEqual({ deliverable_kind: "proposal" });
    expect(admin.calls).toHaveLength(1);
    expect(admin.calls[0]!.args.at(-1)).toEqual(["sow"]);
  });

  it("makes no read when nothing is a SOW, and reads nothing before the table exists", async () => {
    const none = fakeAdmin();
    await withFeeTerms(none as never, [{ id: "deck", meta: {} }]);
    expect(none.calls).toHaveLength(0);
    expect((await readFeeTerms(fakeAdmin({ missing: true }) as never, ["sow"])).size).toBe(0);
  });
});

describe("who can reach the fee table", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (name === "__tests__" || name === "node_modules") return [];
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it("is named only in server files, never in browser code", () => {
    const users = files("src").filter((path) => /work_item_fee_terms|fee-terms\.server/.test(readFileSync(path, "utf8")));
    expect(users.length).toBeGreaterThan(0);
    for (const path of users) expect(path, path).toMatch(/\.server\.ts$|\.functions\.ts$/);
  });

  it("is read by the SOW terms functions only after the Admin or Lead check", () => {
    const source = readFileSync("src/lib/sow-terms.functions.ts", "utf8");
    const gate = source.slice(source.indexOf("async function gate"), source.indexOf("/** The SOW's current terms"));
    expect(gate).toMatch(/if \(!canSetFees\(profile\.role\)\) throw new Response\("Forbidden", \{ status: 403 \}\)/);
    const read = source.slice(source.indexOf("export const readSowTermsFn"), source.indexOf("export const suggestSowTermsFn"));
    expect(read.indexOf("await gate(")).toBeLessThan(read.indexOf("withFeeTerms"));
  });

  it("no browser code reads a fee out of an item's meta", () => {
    for (const path of files("src").filter((p) => !/\.server\.ts$|\.functions\.ts$|-shared\.ts$|demo-firm\//.test(p))) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/sow_facts/);
    }
  });

  it("the demo seed's terms go through the same split", () => {
    const seed = readFileSync("src/lib/demo-firm/seed.server.ts", "utf8");
    expect(seed.match(/await moveSeedFees\(/g)).toHaveLength(2);
    expect(carriesFees(termsWithoutFees(sowFacts({ fee: "$380k", weeks: 14 })))).toBe(false);
  });
});

describe("Ask the firm sources for a Member", () => {
  it("withholds the fee in a SOW's header line and in its summary and decisions", async () => {
    const { maskFees } = await import("@/lib/firm-ask-shared");
    const { withoutFees } = await import("@/lib/firm-corpus-shared");
    const member = (text: string) => maskFees(withoutFees(text));
    expect(member("**Duration:** 12 weeks  **Fee:** $290,000 fixed, plus expenses")).not.toMatch(/290/);
    expect(member("Fixed fee of $290k with expenses capped at 10%")).not.toMatch(/290/);
    expect(member("A retainer of £45,000 per month")).not.toMatch(/45,000/);
  });

  it("masks both the full text and the summary path, and leaves Admins and Leads the real words", () => {
    const source = readFileSync("src/lib/firm-ask.functions.ts", "utf8");
    const preview = source.slice(source.indexOf("export const previewFirmSource"), source.indexOf("recordEvent", source.indexOf("export const previewFirmSource")));
    expect(preview).toMatch(/const raw = body !== null \? body : \[item\.summary, item\.decisions\]/);
    expect(preview).toMatch(/const text = canSeeFees \? raw : maskFees\(withoutFees\(raw\)\)/);
    expect(preview).toMatch(/const canSeeFees = profile\.role === "admin" \|\| profile\.role === "lead"/);
  });

  it("checks a Member's quote against the masked text", () => {
    expect(readFileSync("src/lib/firm-cite.server.ts", "utf8")).toMatch(/deps\.canSeeFees \? text : maskFees\(withoutFees\(text\)\)/);
  });
});

vi.mock("@supabase/supabase-js", () => ({}));
