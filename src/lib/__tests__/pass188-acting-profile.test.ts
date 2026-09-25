import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveProfile } from "@/lib/profile-resolve";

type Row = {
  id: string;
  org_id: string;
  role: string;
  created_at: string;
  deactivated_at: string | null;
};

/** A hand-built Supabase stub: it never reaches the network. */
function stub(rows: Row[]) {
  return {
    from() {
      const state = { activeOnly: false };
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: (_column: string, value: null) => {
          if (value === null) state.activeOnly = true;
          return builder;
        },
        order: () => {
          const ordered = [...rows]
            .filter((row) => (state.activeOnly ? row.deactivated_at === null : true))
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
          return Promise.resolve({ data: ordered, error: null });
        },
      };
      return builder;
    },
  } as never;
}

const OLDEST: Row = {
  id: "p-old",
  org_id: "o-1",
  role: "member",
  created_at: "2024-01-01",
  deactivated_at: null,
};
const NEWER: Row = {
  id: "p-new",
  org_id: "o-2",
  role: "admin",
  created_at: "2025-01-01",
  deactivated_at: null,
};
const GONE: Row = {
  id: "p-gone",
  org_id: "o-3",
  role: "member",
  created_at: "2023-01-01",
  deactivated_at: "2025-06-01",
};

describe("resolveProfile", () => {
  it("returns the oldest active profile when no id is given", async () => {
    const profile = await resolveProfile(stub([NEWER, OLDEST]), "u-1");
    expect(profile?.id).toBe("p-old");
  });

  it("returns the requested profile when the caller holds it", async () => {
    const profile = await resolveProfile(stub([OLDEST, NEWER]), "u-1", "p-new");
    expect(profile?.id).toBe("p-new");
  });

  it("falls back to the oldest when the requested id is not the caller's", async () => {
    const profile = await resolveProfile(stub([OLDEST, NEWER]), "u-1", "p-somebody-else");
    expect(profile?.id).toBe("p-old");
  });

  it("never returns a deactivated profile", async () => {
    const profile = await resolveProfile(stub([GONE, NEWER]), "u-1");
    expect(profile?.id).toBe("p-new");

    const asked = await resolveProfile(stub([GONE, NEWER]), "u-1", "p-gone");
    expect(asked?.id).toBe("p-new");
  });
});

/**
 * invites.server.ts reads every profile a viewer holds on purpose, to answer a
 * cross workspace membership question. It is not a single acting profile read.
 */
// demo-presets.server.ts looks up the caller's profile in the demo org specifically, not the acting profile.
const ALLOWED = new Set(["invites.server.ts", "demo-presets.server.ts"]);

describe("one way to resolve who is acting", () => {
  it("no server module hand-rolls the acting profile lookup", () => {
    const dir = join(process.cwd(), "src/lib");
    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith(".functions.ts") || name.endsWith(".server.ts"))
      .filter((name) => !ALLOWED.has(name))
      .filter((name) => {
        const source = readFileSync(join(dir, name), "utf8");
        const handRolled =
          source.includes('from("profiles")') &&
          source.includes('eq("user_id"') &&
          source.includes("maybeSingle");
        return handRolled && !source.includes("resolveProfile");
      });
    expect(offenders).toEqual([]);
  });
});
