import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 8 Nov 2026 regression: `create or replace function` resets SECURITY DEFINER.
 * workboard_row_touch and workboard_row_create write history rows that signed-in
 * users may not insert themselves, so every redefinition must restate it.
 */
const DEFINER_FUNCTIONS = ["workboard_row_touch", "workboard_row_create"];

describe("history writers keep SECURITY DEFINER", () => {
  it("the hotfix restores it on workboard_row_touch", () => {
    const sql = readFileSync("supabase/migrations/20261108170000_hotfix_workboard_row_touch_security_definer.sql", "utf8");
    expect(sql).toMatch(/alter function public\.workboard_row_touch\(\) security definer;/);
  });

  it("any later migration that redefines a history writer restates security definer", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name > "20261108170000").sort();
    for (const file of files) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      for (const fn of DEFINER_FUNCTIONS) {
        const at = sql.search(new RegExp(`create or replace function public\\.${fn}\\(`, "i"));
        if (at < 0) continue;
        const header = sql.slice(at, sql.indexOf("$function$", at));
        expect(header, `${file} redefines ${fn}`).toMatch(/security definer/i);
      }
    }
  });
});
