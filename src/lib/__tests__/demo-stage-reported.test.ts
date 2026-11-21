// 20 Nov 2026 (Liam, Q-59): a demo workspace is REPORTED to PostHog as stage "demo" so it can be told from real
// firms. Liam's condition: this changes only what is sent to PostHog. So these tests hold three things. The reported
// stage is right. Working it out only reads. And nothing in the app can behave differently because of it: the one
// function that says "demo" is called by the PostHog copy and by nothing else, and no other code reads a stage.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  settings: null as unknown,
  settingsError: null as { message: string } | null,
  stage: "free" as unknown,
  calls: [] as string[],
}));

vi.mock("@/integrations/supabase/client.server", () => {
  // Only reading is possible here. Any write the code tried would throw, and the test would fail.
  const refuse = (name: string) => () => { throw new Error(`a write was attempted: ${name}`); };
  return {
    supabaseAdmin: {
      from: (table: string) => {
        db.calls.push(`from:${table}`);
        return {
          select: (columns: string) => {
            db.calls.push(`select:${columns}`);
            return { eq: () => ({ maybeSingle: async () => (db.settingsError ? { data: null, error: db.settingsError } : { data: { settings: db.settings }, error: null }) }) };
          },
          insert: refuse("insert"), update: refuse("update"), upsert: refuse("upsert"), delete: refuse("delete"),
        };
      },
      rpc: async (fn: string) => {
        db.calls.push(`rpc:${fn}`);
        return { data: db.stage, error: null };
      },
    },
  };
});
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));

import { isDemoWorkspace } from "../demo-text-number-shared";
import { accountStageOf, DEMO_STAGE, resetAccountStageCache } from "../org-type.server";
import { contextProperties } from "../telemetry.server";

const KESTREL_BAY = { type: "company", demo_firm: "kestrel-bay" };

beforeEach(() => {
  resetAccountStageCache();
  db.settings = null;
  db.settingsError = null;
  db.stage = "free";
  db.calls = [];
});

describe("what is reported", () => {
  it("a demo workspace is reported as demo, whatever its stored stage", async () => {
    db.settings = KESTREL_BAY;
    for (const stored of ["free", "pilot", "customer", "internal", "none"]) {
      resetAccountStageCache();
      db.stage = stored;
      await expect(accountStageOf("kestrel")).resolves.toBe("demo");
    }
    expect(DEMO_STAGE).toBe("demo");
    expect(contextProperties({ environment: "production", workspace_type: "company", affiliated: false, partner: "none", account_stage: "demo" })["account_stage"]).toBe("demo");
  });

  it.each([
    ["a real firm", { type: "company" }],
    ["a real firm with other settings", { type: "company", proposal_goal_hours: 72 }],
    ["a firm whose marker is empty", { type: "company", demo_firm: "" }],
    ["a firm whose marker is false", { type: "company", demo_firm: false }],
    ["a personal workspace carrying the marker", { type: "personal", demo_firm: "x" }],
    ["a partner workspace carrying the marker", { type: "partner", demo_firm: "x" }],
    ["no settings", null],
    ["settings that are not a list", "demo_firm"],
  ])("%s keeps its stored stage", async (_label, settings) => {
    db.settings = settings;
    db.stage = "pilot";
    await expect(accountStageOf("real")).resolves.toBe("pilot");
  });

  it("uses the same rule as the rest of the app for what a demo workspace is", () => {
    expect(isDemoWorkspace(KESTREL_BAY)).toBe(true);
    expect(readFileSync("src/lib/org-type.server.ts", "utf8")).toContain("isDemoWorkspace(data?.settings ?? null)");
  });

  it("falls back to the stored stage when the marker cannot be read, and never guesses demo", async () => {
    db.settings = KESTREL_BAY;
    db.settingsError = { message: "down" };
    db.stage = "free";
    await expect(accountStageOf("kestrel")).resolves.toBe("free");
  });

  it("no workspace, no stage, no read", async () => {
    await expect(accountStageOf(null)).resolves.toBeNull();
    await expect(accountStageOf(undefined)).resolves.toBeNull();
    expect(db.calls).toEqual([]);
  });
});

describe("working it out only reads", () => {
  it("one read of the settings for a demo workspace, and the stored stage is not even asked for", async () => {
    db.settings = KESTREL_BAY;
    await accountStageOf("kestrel");
    await accountStageOf("kestrel");
    expect(db.calls).toEqual(["from:orgs", "select:settings"]);
  });

  it("a read of the settings and the stage function for a real firm, nothing else", async () => {
    db.settings = { type: "company" };
    await accountStageOf("real");
    expect(db.calls).toEqual(["from:orgs", "select:settings", "rpc:account_stage"]);
  });

  it("the source has no write beside it", () => {
    const source = readFileSync("src/lib/org-type.server.ts", "utf8");
    for (const write of [".insert(", ".update(", ".upsert(", ".delete("]) expect(source).not.toContain(write);
  });
});

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "__tests__" && name !== "node_modules") sources(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("nothing in the app can behave differently", () => {
  const files = sources("src").map((path) => ({ path: path.replaceAll("\\", "/"), text: readFileSync(path, "utf8") }));

  it("only the PostHog copy asks for the reported stage", () => {
    const callers = files.filter((file) => file.text.includes("accountStageOf")).map((file) => file.path).sort();
    expect(callers).toEqual(["src/lib/org-type.server.ts", "src/lib/telemetry-v2.server.ts", "src/lib/telemetry.server.ts"]);
  });

  it("in both callers the stage goes into the copy's context and nowhere else", () => {
    for (const path of ["src/lib/telemetry.server.ts", "src/lib/telemetry-v2.server.ts"]) {
      const text = files.find((file) => file.path === path)!.text;
      const uses = text.split("\n").filter((line) => /accountStage\b/.test(line) && !line.includes("accountStageOf")).map((line) => line.trim());
      expect(uses).toEqual(["let accountStage: string | null = null;", "...(accountStage ? { account_stage: accountStage } : {}),"]);
    }
  });

  it("no other code reads a workspace's stage: not limits, gates, the tour, the demo number, practice or billing", () => {
    const readers = files.filter((file) => file.text.includes("account_stage") || file.text.includes("DEMO_STAGE")).map((file) => file.path).sort();
    expect(readers).toEqual([
      "src/integrations/supabase/types.ts", // generated: the SQL function's signature and one report's column
      "src/lib/org-type.server.ts",
      "src/lib/telemetry-v2.server.ts",
      "src/lib/telemetry.server.ts",
    ]);
  });

  it("the stored event row never carries a stage, so nothing can read it back from there", () => {
    const telemetry = files.find((file) => file.path === "src/lib/telemetry.server.ts")!.text;
    const inserts = [...telemetry.matchAll(/\.from\("events"\)\.insert\(\{[\s\S]*?\n    \}\);/g)].map((match) => match[0]);
    expect(inserts).toHaveLength(2);
    for (const insert of inserts) {
      expect(insert).toContain("event_type");
      expect(insert).not.toMatch(/account_?stage/i);
    }
    const stamp = readFileSync("src/lib/org-type.server.ts", "utf8");
    expect(stamp.slice(stamp.indexOf("export type WorkspaceStamp"))).not.toMatch(/account_?stage|DEMO_STAGE/i);
  });

  it("what makes a workspace a demo for the app is untouched: the same pure rule, reading the same marker", () => {
    const rule = readFileSync("src/lib/demo-text-number-shared.ts", "utf8");
    expect(rule).toContain('return record["type"] === "company" && "demo_firm" in record && Boolean(record["demo_firm"]);');
    expect(rule).not.toContain("stage");
  });

  it("no SQL was added or changed for this", () => {
    // Later files that belong to other work are named here; anything else added after this one still fails the test.
    const otherWork = ["20261120100000_roster_contact_details.sql", "20261120200000_make_invite_offers.sql", "20261121000000_proposals_client_due_on.sql", "20261121010000_notifications_brief_passed.sql", "20261121020000_roster_contacts_profile.sql", "20261121030000_proposal_lead_docs.sql", "20261121040000_proposal_final_versions.sql", "20261121050000_proposal_approvals.sql"];
    const migrations = readdirSync("supabase/migrations").filter(
      (name) => name > "20261120030000_lead_asks.sql" && !otherWork.includes(name),
    );
    expect(migrations).toEqual([]);
  });
});
